/**
 * Renders one SVG card per curated project into assets/cards/.
 *
 * Prose comes from data/projects.json; stars, forks and language come from the
 * GitHub API at build time. The README links each card, so the cards stay
 * clickable — an <a> inside an <img>-rendered SVG is not.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchProfile, indexRepos } from './lib/github.mjs';
import { esc, ink, langColor, pigment, svg, tessellation, wrap } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const W = 560;
const H = 176;
const PAD = 26;

/** Five-point star, centred on (cx, cy). Drawn rather than typed so the glyph
 *  never depends on which fonts the reader's browser happens to have. */
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
  const width = label.length * 6.4 + 18;
  return `<g>
    <rect x="${x}" y="${y}" width="${width.toFixed(1)}" height="20" rx="2" fill="${color}" fill-opacity="0.10" stroke="${color}" stroke-opacity="0.34"/>
    <text class="mono" x="${(x + width / 2).toFixed(1)}" y="${y + 14}" text-anchor="middle" font-size="10" fill="${color}" fill-opacity="0.95">${esc(label)}</text>
  </g>`;
  }

function card(project, repo) {
  const accent = langColor[repo?.primaryLanguage?.name] ?? pigment.gold;
  const stars = repo?.stargazerCount ?? 0;
  const lines = wrap(project.blurb, { fontSize: 11.5, maxWidth: W - PAD * 2 - 20, maxLines: 3 });

  const chips = [];
  let cursor = PAD;
  for (const label of project.stack) {
    chips.push(chip(cursor, H - 44, label, accent));
    cursor += label.length * 6.4 + 18 + 8;
  }

  const body = `
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="2" fill="${ink.panel}" stroke="${pigment.gold}" stroke-opacity="0.28"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="2" fill="url(#ground)" opacity="0.10"/>
  <rect x="0" y="0" width="3" height="${H}" fill="${accent}" fill-opacity="0.9"/>

  <g class="anim rise">
    <text class="serif" x="${PAD}" y="46" font-size="23" letter-spacing="0.4" fill="${pigment.gold}">${esc(project.title)}</text>

    ${stars > 0 ? `<g fill="${pigment.gold}" fill-opacity="0.75" transform="translate(${W - PAD - 34} 40)">${star(0, 0, 7)}</g>
    <text class="mono" x="${W - PAD}" y="45" text-anchor="end" font-size="12" fill="${pigment.cream}" fill-opacity="0.7">${stars}</text>` : ''}

    ${lines
      .map(
        (line, i) =>
          `<text class="mono" x="${PAD}" y="${76 + i * 19}" font-size="11.5" fill="${pigment.cream}" fill-opacity="0.68">${esc(line)}</text>`,
      )
      .join('\n    ')}

    ${chips.join('\n    ')}
  </g>

  <g stroke="${pigment.gold}" stroke-opacity="0.30" stroke-width="1" fill="none">
    <path d="M${W - 14} 10 h-10 M${W - 14} 10 v10"/>
    <path d="M${W - 14} ${H - 10} h-10 M${W - 14} ${H - 10} v-10"/>
  </g>`;

  return svg({
    width: W,
    height: H,
    title: `${project.title} — ${project.blurb}`,
    defs: tessellation('ground', { size: 64 }),
    style: `
      .rise { opacity: 0; transform: translateY(6px); animation: rise .55s cubic-bezier(.2,.7,.3,1) .05s forwards; }
      @keyframes rise { to { opacity: 1; transform: translateY(0) } }`,
    body,
  });
}

const manifest = JSON.parse(await readFile(resolve(root, 'data/projects.json'), 'utf8'));
const profile = await fetchProfile(manifest.owner);
const byName = indexRepos(profile.repos);

await mkdir(resolve(root, 'assets/cards'), { recursive: true });

for (const project of manifest.projects) {
  const repo = byName.get(project.repo.toLowerCase());
  if (!repo) {
    console.warn(`! ${project.repo}: not found on GitHub — card rendered without live stats`);
  }
  const file = resolve(root, 'assets/cards', `${project.repo.toLowerCase()}.svg`);
  await writeFile(file, card(project, repo), 'utf8');
  console.log(`  assets/cards/${project.repo.toLowerCase()}.svg  ${repo?.stargazerCount ?? 0}★`);
}

console.log(`Built ${manifest.projects.length} project cards.`);
