/**
 * Renders assets/stack.svg — the tech stack, grouped and chipped.
 *
 * Chips wrap onto as many rows as they need and the canvas height is measured
 * from the result, so editing data/stack.json can never overflow the artwork
 * or leave a band of empty space under it.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bg, esc, langColor, monoWidth, svg, syntax } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1200;
const PAD = 28;
const CHIP_H = 34;
const CHIP_GAP = 9;
const ROW_GAP = 10;
const GROUP_GAP = 30;
const LABEL_H = 26;
const FONT = 12.5;

const chipWidth = (label) => Math.round(monoWidth(label, FONT) + 30);

/** Lay chips out left to right, wrapping at the content width. */
function layout(items, maxWidth) {
  const rows = [[]];
  let used = 0;

  for (const label of items) {
    const width = chipWidth(label);
    const needed = used === 0 ? width : used + CHIP_GAP + width;

    if (needed > maxWidth && used > 0) {
      rows.push([]);
      used = width;
    } else {
      used = needed;
    }
    rows[rows.length - 1].push({ label, width });
  }

  return rows;
}

function build(groups) {
  const contentWidth = W - PAD * 2;
  const measured = groups.map((group) => ({
    ...group,
    rows: layout(group.items, contentWidth),
  }));

  const height =
    PAD +
    measured.reduce(
      (sum, g) => sum + LABEL_H + g.rows.length * CHIP_H + (g.rows.length - 1) * ROW_GAP + GROUP_GAP,
      0,
    ) -
    GROUP_GAP +
    PAD;

  const parts = [];
  let y = PAD;
  let index = 0;

  for (const group of measured) {
    const accent = syntax[group.accent] ?? syntax.blue;

    parts.push(
      `<text class="mono" x="${PAD}" y="${y + 14}" font-size="12.5" fill="${syntax.muted}">// ${esc(group.label)}</text>`,
    );
    y += LABEL_H;

    for (const row of group.rows) {
      let x = PAD;
      for (const chip of row) {
        const color = langColor[chip.label] ?? accent;
        parts.push(`<g class="fx pop" style="animation-delay:${(index * 0.025).toFixed(3)}s">
      <rect x="${x}" y="${y}" width="${chip.width}" height="${CHIP_H}" rx="8" fill="${bg.panel}" stroke="${bg.line}"/>
      <circle cx="${x + 14}" cy="${y + CHIP_H / 2}" r="3.5" fill="${color}"/>
      <text class="mono" x="${x + 24}" y="${y + CHIP_H / 2 + 4.5}" font-size="${FONT}" fill="${syntax.text}" fill-opacity="0.92">${esc(chip.label)}</text>
    </g>`);
        x += chip.width + CHIP_GAP;
        index += 1;
      }
      y += CHIP_H + ROW_GAP;
    }

    y += GROUP_GAP - ROW_GAP;
  }

  const summary = groups.map((g) => `${g.label}: ${g.items.join(', ')}`).join('. ');

  return svg({
    width: W,
    height,
    title: `Tech stack. ${summary}.`,
    style: `
      .pop { animation: pop .45s cubic-bezier(.2,.7,.3,1) backwards; }
      @keyframes pop { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }`,
    body: `  ${parts.join('\n  ')}`,
    background: bg.base,
  });
}

const { groups } = JSON.parse(await readFile(resolve(root, 'data/stack.json'), 'utf8'));
await writeFile(resolve(root, 'assets/stack.svg'), build(groups), 'utf8');

console.log(`assets/stack.svg — ${groups.length} groups, ${groups.reduce((n, g) => n + g.items.length, 0)} chips`);
