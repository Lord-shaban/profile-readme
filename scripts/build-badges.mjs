/**
 * Renders assets/badges/*.svg — the contact row.
 *
 * These replace shields.io: a generic badge service cannot be told about this
 * palette, and every request is a third party the profile has to stay up.
 * The marks are typographic rather than brand logos, which keeps the row in
 * the same voice as the rest of the page.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { esc, ink, pigment, svg } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const H = 38;
const PAD = 15;
const GAP = 10;
const MARK = 20;

const badges = [
  { file: 'linkedin', mark: 'in', label: 'LinkedIn', accent: pigment.gold },
  { file: 'x', mark: '✕', label: 'X / Twitter', accent: pigment.cream },
  { file: 'facebook', mark: 'f', label: 'Facebook', accent: pigment.gold },
  { file: 'email', mark: '@', label: 'Email', accent: pigment.verdigris },
  { file: 'location', mark: '◈', label: '6th of October, Egypt', accent: pigment.ochre, plain: true },
];

function badge({ mark, label, accent, plain }) {
  const labelWidth = label.length * 7.1;
  const W = Math.round(PAD + MARK + GAP + labelWidth + PAD);
  const markX = PAD + MARK / 2;
  const labelX = PAD + MARK + GAP;

  const body = `
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="2" fill="${ink.panel}" stroke="${accent}" stroke-opacity="0.38"/>
  <rect x="0" y="0" width="2.5" height="${H}" fill="${accent}" fill-opacity="0.85"/>
  <text class="serif" x="${markX}" y="${H / 2 + 6}" text-anchor="middle" font-size="17" fill="${accent}" fill-opacity="0.95">${esc(mark)}</text>
  <line x1="${PAD + MARK + GAP / 2 - 1}" y1="9" x2="${PAD + MARK + GAP / 2 - 1}" y2="${H - 9}" stroke="${accent}" stroke-opacity="0.22"/>
  <text class="mono" x="${labelX}" y="${H / 2 + 4}" font-size="11.5" letter-spacing="0.4" fill="${pigment.cream}" fill-opacity="${plain ? 0.6 : 0.88}">${esc(label)}</text>`;

  return svg({ width: W, height: H, title: label, body });
}

await mkdir(resolve(root, 'assets/badges'), { recursive: true });

for (const spec of badges) {
  await writeFile(resolve(root, 'assets/badges', `${spec.file}.svg`), badge(spec), 'utf8');
  console.log(`  assets/badges/${spec.file}.svg`);
}

console.log(`Built ${badges.length} badges.`);
