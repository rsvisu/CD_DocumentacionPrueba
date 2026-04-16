import { promises as fs } from 'node:fs';
import path from 'node:path';

const DOCS_DIR = path.resolve('src/content/docs');
const DOC_EXTENSIONS = new Set(['.md', '.mdx']);

async function main() {
  const files = await collectMarkdownFiles(DOCS_DIR);
  let updatedCount = 0;

  for (const filePath of files) {
    const original = await fs.readFile(filePath, 'utf8');
    const next = ensureTitleInFrontmatter(original, filePath);

    if (next !== original) {
      await fs.writeFile(filePath, next, 'utf8');
      updatedCount += 1;
    }
  }

  console.log(`[titles:sync] Updated ${updatedCount} file(s).`);
}

async function collectMarkdownFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await collectMarkdownFiles(fullPath)));
      continue;
    }

    if (DOC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }

  return results;
}

function ensureTitleInFrontmatter(source, filePath) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    if (/^title\s*:/m.test(frontmatter)) {
      return source;
    }

    const body = source.slice(frontmatterMatch[0].length);
    const title = deriveTitle(body, filePath);

    const frontmatterLines = frontmatter.split(/\r?\n/).filter(Boolean);
    frontmatterLines.unshift(`title: ${toYamlString(title)}`);

    const nextFrontmatter =
      `---${eol}` + frontmatterLines.join(eol) + `${eol}---${eol}${eol}`;

    return nextFrontmatter + body.replace(/^\r?\n/, '');
  }

  const title = deriveTitle(source, filePath);
  const generatedFrontmatter =
    `---${eol}title: ${toYamlString(title)}${eol}---${eol}${eol}`;

  return generatedFrontmatter + source;
}

function deriveTitle(body, filePath) {
  const h1Match = body.match(/^#\s+(.+?)\s*$/m);

  if (h1Match?.[1]) {
    const cleaned = h1Match[1]
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim();

    if (cleaned) return cleaned;
  }

  const fileName = path.basename(filePath, path.extname(filePath));
  return fileName
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}

function toYamlString(value) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

main().catch((error) => {
  console.error('[titles:sync] Failed:', error);
  process.exitCode = 1;
});
