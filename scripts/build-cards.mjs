/**
 * Renders one SVG card per curated project into assets/cards/.
 *
 * Prose comes from data/projects.json; stars and language come from the
 * GitHub API at build time. The README wraps each card in a link, because an
 * <a> inside an SVG that GitHub renders through <img> is not clickable.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchProfile, indexRepos } from './lib/github.mjs';
import { bg, colorFor, esc, svg, syntax, wrap } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const W = 560;
const H = 184;
const PAD = 28;

/** Five-point star, drawn rather than typed so it never depends on a font. */
function star(cx, cy, r) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `<polygon points="${points.join(' ')}"/>`;
}

function chip(x, y, label, color) {
  const width = label.length * 6.6 + 20;
  return {
    width,
    markup: `<g>
      <rect x="${x}" y="${y}" width="${width.toFixed(1)}" height="22" rx="5" fill="${color}" fill-opacity="0.12"/>
      <text class="mono" x="${(x + width / 2).toFixed(1)}" y="${y + 15}" text-anchor="middle" font-size="11" fill="${color}" fill-opacity="0.95">${esc(label)}</text>
    </g>`,
  };
}

function card(project, repo) {
  const language = repo?.primaryLanguage?.name;
  const accent = colorFor(language ?? 'Other');
  const stars = repo?.stargazerCount ?? 0;
  const lines = wrap(project.blurb, { fontSize: 13.5, maxWidth: W - PAD * 2 - 30, maxLines: 3 });

  let cursor = PAD;
  const chips = project.stack.map((label) => {
    const c = chip(cursor, H - 46, label, accent);
    cursor += c.width + 8;
    return c.markup;
  });

  const body = `
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${bg.panel}" stroke="${bg.line}"/>
  <path d="M0 10 a10 10 0 0 1 10 -10 h1 v${H} h-1 a10 10 0 0 1 -10 -10 z" fill="${accent}"/>

  <g class="fx rise">
    <circle cx="${PAD + 5}" cy="41" r="5.5" fill="${accent}"/>
    <text class="sans" x="${PAD + 20}" y="47" font-size="19" font-weight="600" fill="${syntax.text}">${esc(project.title)}</text>

    ${
      stars > 0
        ? `<g fill="${syntax.yellow}" fill-opacity="0.9" transform="translate(${W - PAD - 26} 41)">${star(0, 0, 7)}</g>
    <text class="mono" x="${W - PAD}" y="46" text-anchor="end" font-size="12.5" fill="${syntax.muted}">${stars}</text>`
        : ''
    }

    ${lines
      .map(
        (line, i) =>
          `<text class="sans" x="${PAD}" y="${80 + i * 21}" font-size="13.5" fill="${syntax.muted}">${esc(line)}</text>`,
      )
      .join('\n    ')}

    ${chips.join('\n    ')}
  </g>`;

  return svg({
    width: W,
    height: H,
    title: `${project.title} — ${project.blurb}${stars ? ` (${stars} stars)` : ''}`,
    style: `
      .rise { animation: rise .5s cubic-bezier(.2,.7,.3,1) .05s backwards; }
      @keyframes rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`,
    body,
    background: bg.base,
  });
}

const manifest = JSON.parse(await readFile(resolve(root, 'data/projects.json'), 'utf8'));
const profile = await fetchProfile(manifest.owner);
const byName = indexRepos(profile.repos);

await mkdir(resolve(root, 'assets/cards'), { recursive: true });

for (const project of manifest.projects) {
  const repo = byName.get(project.repo.toLowerCase());
  if (!repo) console.warn(`! ${project.repo}: not found on GitHub — card rendered without live stats`);

  await writeFile(
    resolve(root, 'assets/cards', `${project.repo.toLowerCase()}.svg`),
    card(project, repo),
    'utf8',
  );
  console.log(`  assets/cards/${project.repo.toLowerCase()}.svg  ${repo?.stargazerCount ?? 0}★`);
}

console.log(`Built ${manifest.projects.length} project cards.`);
