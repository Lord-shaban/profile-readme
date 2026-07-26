/**
 * Renders assets/badges/*.svg — the contact row.
 *
 * These replace shields.io: a generic badge service cannot be told about this
 * palette, and every request is one more third party the page has to stay up.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bg, esc, monoWidth, svg, syntax } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const H = 40;
const PAD = 14;
const ICON = 18;
const GAP = 9;
const FONT = 12.5;

/** Icons are drawn, not typed, so they never depend on the reader's fonts. */
const icons = {
  linkedin: (c) =>
    `<rect x="0" y="0" width="${ICON}" height="${ICON}" rx="4" fill="${c}" fill-opacity="0.18"/>
     <text class="sans" x="${ICON / 2}" y="${ICON / 2 + 4.5}" text-anchor="middle" font-size="11" font-weight="700" fill="${c}">in</text>`,
  x: (c) =>
    `<path d="M3 3 L15 15 M15 3 L3 15" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`,
  facebook: (c) =>
    `<rect x="0" y="0" width="${ICON}" height="${ICON}" rx="4" fill="${c}" fill-opacity="0.18"/>
     <text class="sans" x="${ICON / 2}" y="${ICON / 2 + 5}" text-anchor="middle" font-size="12" font-weight="700" fill="${c}">f</text>`,
  email: (c) =>
    `<rect x="1" y="3.5" width="16" height="11.5" rx="2.5" fill="none" stroke="${c}" stroke-width="1.6"/>
     <path d="M1.8 5 L9 10.5 L16.2 5" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  location: (c) =>
    `<path d="M9 16.5 C9 16.5 15 10.8 15 7.2 A6 6 0 0 0 3 7.2 C3 10.8 9 16.5 9 16.5 Z" fill="none" stroke="${c}" stroke-width="1.6"/>
     <circle cx="9" cy="7.2" r="2.1" fill="${c}"/>`,
};

const badges = [
  { file: 'linkedin', icon: 'linkedin', label: 'LinkedIn', color: syntax.blue },
  { file: 'x', icon: 'x', label: 'X / Twitter', color: syntax.text },
  { file: 'facebook', icon: 'facebook', label: 'Facebook', color: syntax.purple },
  { file: 'email', icon: 'email', label: 'Email', color: syntax.green },
  { file: 'location', icon: 'location', label: '6th of October, Egypt', color: syntax.orange, muted: true },
];

function badge({ icon, label, color, muted }) {
  const labelWidth = monoWidth(label, FONT);
  const W = Math.round(PAD + ICON + GAP + labelWidth + PAD);

  const body = `
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="9" fill="${bg.panel}" stroke="${bg.line}"/>
  <g transform="translate(${PAD} ${(H - ICON) / 2})">
    ${icons[icon](color)}
  </g>
  <text class="mono" x="${PAD + ICON + GAP}" y="${H / 2 + 4.5}" font-size="${FONT}" fill="${muted ? syntax.muted : syntax.text}">${esc(label)}</text>`;

  return svg({ width: W, height: H, title: label, body, background: bg.panel });
}

await mkdir(resolve(root, 'assets/badges'), { recursive: true });

for (const spec of badges) {
  await writeFile(resolve(root, 'assets/badges', `${spec.file}.svg`), badge(spec), 'utf8');
  console.log(`  assets/badges/${spec.file}.svg`);
}

console.log(`Built ${badges.length} badges.`);
