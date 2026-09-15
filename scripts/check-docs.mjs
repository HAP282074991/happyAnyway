import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = ['AGENTS.md', 'README.md', 'scripts/verify.ps1', 'happyAnyway-api/AGENTS.md', 'happyAnyway-wechat/AGENTS.md', 'docs/requirements/README.md', 'docs/requirements/analysis.md', 'docs/requirements/specification.md', 'docs/requirements/change-management.md', 'docs/requirements/overview.md', 'docs/requirements/roadmap.md', 'docs/requirements/contracts.md', 'docs/progress.md', 'docs/tasks/TEMPLATE.md', 'docs/agent-init.md', 'docs/agents/product-designer.md', 'docs/agents/backend-developer.md', 'docs/agents/wechat-developer.md', 'docs/agents/reviewer.md', 'docs/agents/tester.md', 'docs/workflow.md'];

// Extract file destinations, not heading anchors. Code examples are not links.
export function markdownTargets(markdown) {
  let fence;
  const listIndents = [];
  const prose = markdown.split(/\r?\n/).map(line => {
    // Track list content indentation so nested prose is not mistaken for code.
    // Tabs advance to four-column stops, including mixed space/tab prefixes.
    line = line.replace(/^[ \t]+/, prefix => {
      let width = 0;
      for (const ch of prefix) width += ch === '\t' ? 4 - width % 4 : 1;
      return ' '.repeat(width);
    });
    if (!line.trim()) return '';
    const indent = line.match(/^ */)[0].length;
    while (listIndents.length && indent < listIndents.at(-1)) listIndents.pop();
    let content = line.slice(listIndents.at(-1) ?? 0);
    if (!fence) {
      const list = content.match(/^( {0,3})(?:[-+*]|\d{1,9}[.)])( +)(.*)$/);
      if (list) {
        // Five or more padding spaces mean one separator plus indented code.
        const padding = list[2].length > 4 ? 1 : list[2].length;
        const markerWidth = list[0].length - list[3].length - list[2].length;
        listIndents.push((listIndents.at(-1) ?? 0) + markerWidth + padding);
        content = content.slice(markerWidth + padding);
      }
    }
    const marker = content.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      return '';
    }
    if (marker) { fence = marker[1]; return ''; }
    return /^ {4}/.test(content) ? '' : content;
  }).join('\n').replace(/(`+)([\s\S]*?)\1(?!`)/g, '');
  const targets = [];
  // Reference definitions also cover full, collapsed and shortcut references.
  for (const match of prose.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(?:<([^>\n]*)>|(\S+))/gm)) {
    targets.push(match[1] ?? match[2]);
  }
  for (const match of prose.matchAll(/(?<!\\)\]\(\s*/g)) {
    let i = match.index + match[0].length;
    let target = '';
    let depth = 0;
    const angle = prose[i] === '<';
    if (angle) i++;
    for (; i < prose.length; i++) {
      const ch = prose[i];
      if (ch === '\\' && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(prose[i + 1] ?? '')) {
        target += ch + prose[++i];
      } else if (angle ? ch === '>' : (ch === ')' && depth === 0) || /\s/.test(ch)) {
        break;
      } else {
        if (!angle && ch === '(') depth++;
        if (!angle && ch === ')') depth--;
        target += ch;
      }
    }
    // Remaining text can only be an optional title followed by the closing ).
    const suffix = prose.slice(i + (angle ? 1 : 0));
    if (/^\s*(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\))?\s*\)/.test(suffix)) targets.push(target);
  }
  return targets;
}

export function checkMarkdown(path, markdown) {
  for (const raw of markdownTargets(markdown)) {
    let target = raw.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1');
    const windowsPath = /^[a-zA-Z]:[\\/]/.test(target);
    if (!windowsPath && (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) || target.startsWith('//'))) continue;
    target = target.split(/[?#]/)[0];
    if (!target) continue;
    try { target = decodeURIComponent(target); }
    catch { throw new Error('Invalid link encoding: ' + path + ' -> ' + raw); }
    if (!existsSync(resolve(dirname(path), target))) throw new Error('Broken link: ' + path + ' -> ' + target);
  }
}

export function checkMarkdownTree(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'target', '.reports'].includes(entry.name) || entry.isSymbolicLink()) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) checkMarkdownTree(path);
    else if (entry.name.toLowerCase().endsWith('.md')) checkMarkdown(path, readFileSync(path, 'utf8'));
  }
}

export function checkReference(ref, path, root) {
  if (!ref || typeof ref !== 'object' || ref.schemaVersion !== 1) throw new Error('Invalid schemaVersion: ' + path);
  if (typeof ref.repositoryPath !== 'string' || !ref.repositoryPath.trim()) throw new Error('Invalid repositoryPath: ' + path);
  const repository = resolve(dirname(path), ref.repositoryPath);
  if (ref.repository !== 'happyAnyway' || repository !== root) throw new Error('Invalid root repository reference: ' + path);
  if (typeof ref.documentsPath !== 'string' || resolve(repository, ref.documentsPath) !== join(root, 'docs', 'requirements')) throw new Error('Invalid requirements reference: ' + path);
  if (!existsSync(join(repository, ref.documentsPath, 'README.md'))) throw new Error('Missing requirements: ' + path);
  if (!Array.isArray(ref.features) || ref.features.some(id => typeof id !== 'string' || !id.trim() || id !== id.trim()) || new Set(ref.features).size !== ref.features.length) throw new Error('Invalid features: ' + path);
  // pinned means a syntactically pinned reference, not approved business work.
  if (!['bootstrap-unpinned', 'pinned'].includes(ref.status)) throw new Error('Invalid status: ' + path);
  if (ref.status === 'bootstrap-unpinned' ? ref.revision !== null : typeof ref.revision !== 'string' || !/^[a-f0-9]{40}$/.test(ref.revision)) throw new Error('Invalid revision: ' + path);
}

export function checkProject(projectRoot = root) {
  for (const path of required) {
    const absolute = join(projectRoot, path);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) throw new Error('Missing required file: ' + path);
  }
  checkMarkdownTree(projectRoot);
  for (const component of ['happyAnyway-api', 'happyAnyway-wechat']) {
    const path = join(projectRoot, component, 'specs-reference.json');
    const ref = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
    checkReference(ref, path, projectRoot);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--markdown-tree' && process.argv.length === 4) {
    checkMarkdownTree(resolve(process.argv[3]));
    console.log('PASS: Markdown file links; heading anchors are not checked.');
  } else if (process.argv.length === 2) {
    checkProject();
    console.log('PASS: required files, Markdown file links and specification reference fields; heading anchors, dispatch fields, business approval and commit contents are not checked.');
  } else {
    throw new Error('Usage: node check-docs.mjs [--markdown-tree directory]');
  }
}
