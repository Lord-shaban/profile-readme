/**
 * Pre-flight check for everything the README points at.
 *
 * GitHub renders a malformed SVG as a broken-image icon with no error anywhere,
 * so problems here are invisible until someone views the profile. This runs in
 * CI on every push and fails loudly instead.
 *
 *   1. every SVG in assets/ is well-formed and declares a viewBox
 *   2. every local image the README references actually exists
 *   3. every link to a repo of this owner points at a repo that exists
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TOKEN, request } from './lib/github.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const problems = [];
const note = (file, message) => problems.push(`${file}: ${message}`);

/** Recursively list files under `dir` matching `ext`. */
async function walk(dir, ext, found = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, ext, found);
    else if (entry.name.endsWith(ext)) found.push(full);
  }
  return found;
}

/**
 * Minimal XML well-formedness check: tags balance, and nothing is left open.
 * Comments and the contents of <style> are skipped, since CSS is not markup.
 */
function checkWellFormed(source, file) {
  const stripped = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '<style/>');

  const voidish = new Set(['?xml']);
  const stack = [];

  for (const match of stripped.matchAll(/<\/?([a-zA-Z?][\w:?-]*)([^>]*)>/g)) {
    const [tag, name, attrs] = match;
    if (voidish.has(name) || tag.startsWith('<?')) continue;

    if (tag.startsWith('</')) {
      const open = stack.pop();
      if (open !== name) {
        note(file, `closing </${name}> does not match open <${open ?? 'nothing'}>`);
        return;
      }
      continue;
    }

    if (attrs.trimEnd().endsWith('/')) continue; // self-closing

    // Unbalanced quotes inside an attribute list mean the tag was truncated.
    const quotes = (attrs.match(/"/g) ?? []).length;
    if (quotes % 2 !== 0) note(file, `unbalanced quotes in <${name}>`);

    stack.push(name);
  }

  if (stack.length) note(file, `unclosed <${stack[stack.length - 1]}>`);
}

// ---- 1. assets -------------------------------------------------------------

const svgs = await walk(resolve(root, 'assets'), '.svg');
if (!svgs.length) note('assets/', 'no SVGs found — did the build run?');

for (const file of svgs) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const source = await readFile(file, 'utf8');

  if (!source.trimStart().startsWith('<svg')) note(rel, 'does not start with <svg>');
  if (!/viewBox="/.test(source)) note(rel, 'missing viewBox — will not scale on GitHub');
  if (!/role="img"/.test(source)) note(rel, 'missing role="img"');
  if (!/<title>/.test(source)) note(rel, 'missing <title> — screen readers have nothing to announce');
  if (/<script/i.test(source)) note(rel, 'contains <script>, which GitHub strips');
  checkWellFormed(source, rel);
}

// ---- 2. README references --------------------------------------------------

const readme = await readFile(resolve(root, 'README.md'), 'utf8');

const referenced = new Set();
for (const match of readme.matchAll(/(?:src|href)="([^"]+)"/g)) referenced.add(match[1]);
for (const match of readme.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) referenced.add(match[1]);

const localRefs = [...referenced].filter((r) => !/^(https?:|mailto:|#)/.test(r));

for (const ref of localRefs) {
  try {
    await stat(resolve(root, ref));
  } catch {
    note('README.md', `references missing file: ${ref}`);
  }
}

// Every asset that was built should be used; an orphan means a rename was missed.
for (const file of svgs) {
  const rel = relative(root, file).replace(/\\/g, '/');
  if (!localRefs.includes(rel)) note(rel, 'built but not referenced by README.md');
}

// ---- 3. repo links ---------------------------------------------------------

const owner = JSON.parse(await readFile(resolve(root, 'data/projects.json'), 'utf8')).owner;
const repoLinks = [...referenced].filter((r) =>
  r.startsWith(`https://github.com/${owner}/`),
);

let checkedLinks = 0;

if (TOKEN) {
  for (const link of repoLinks) {
    const path = link.replace('https://github.com/', '').replace(/\/$/, '');
    if (path.split('/').length !== 2) continue; // profile or query links

    const res = await request(`https://api.github.com/repos/${path}`);
    if (!res.ok) note('README.md', `links to ${link} → HTTP ${res.status}`);
    checkedLinks += 1;
  }
} else {
  console.log('· no token: skipping repo-link check');
}

// ---- report ----------------------------------------------------------------

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

console.log(`✓ ${svgs.length} SVGs well-formed · ${localRefs.length} README references resolve · ${checkedLinks} repo links checked`);
