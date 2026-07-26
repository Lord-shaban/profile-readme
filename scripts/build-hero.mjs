/**
 * Renders assets/hero.svg — the editor window at the top of the profile.
 *
 * The page opens on a file rather than a banner: tab strip, gutter, syntax
 * colours and a status bar, with the source typing itself in. Each line is
 * revealed by animating `clip-path: inset()` with a `steps(n)` timing
 * function where n is the line's character count, so the reveal lands on
 * glyph boundaries instead of sliding smoothly across them.
 *
 * All timings are derived from the source below, so editing the code cannot
 * desynchronise the animation.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { highlight } from './lib/highlight.mjs';
import { CHAR, bg, esc, monoWidth, svg, syntax, windowDots } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1200;
const TAB_H = 46;
const STATUS_H = 34;
const FONT = 15.5;
const LINE = 27;
const GUTTER = 66; // right edge of the line-number column
const CODE_X = 92;
const TOP_PAD = 26;

const SOURCE = `const ahmed: Engineer = {
  name:      "Ahmed Sha'ban",
  role:      "Software Engineer",
  studying:  "Nile University",
  leads:     "Abakera NU",

  builds:    ["Flutter apps", "Laravel APIs", "realtime systems"],
  exploring: ["LLMs in production", "Firebase Cloud"],

  ships:     true,  // finished products, not practice projects
}`.split('\n');

const CODE_H = TOP_PAD * 2 + SOURCE.length * LINE;
const H = TAB_H + CODE_H + STATUS_H;

const PER_CHAR = 0.02;
const MAX_LINE_DUR = 0.7;
const STAGGER = 0.14;
const START = 0.45;

function tab({ x, label, active, color }) {
  const width = monoWidth(label, 13) + 46;
  return {
    width,
    markup: `<g>
    <rect x="${x}" y="0" width="${width}" height="${TAB_H}" fill="${active ? bg.base : 'none'}"/>
    ${active ? `<rect x="${x}" y="0" width="${width}" height="2" fill="${syntax.blue}"/>` : ''}
    <circle cx="${x + 18}" cy="${TAB_H / 2}" r="4" fill="${color}" fill-opacity="${active ? 1 : 0.5}"/>
    <text class="mono" x="${x + 30}" y="${TAB_H / 2 + 4.5}" font-size="13" fill="${active ? syntax.text : syntax.muted}">${esc(label)}</text>
  </g>`,
  };
}

function build() {
  // --- tab strip ---------------------------------------------------------
  const tabs = [];
  let tabX = 96;
  for (const spec of [
    { label: 'ahmed.ts', active: true, color: syntax.blue },
    { label: 'README.md', active: false, color: syntax.muted },
  ]) {
    const t = tab({ ...spec, x: tabX });
    tabs.push(t.markup);
    tabX += t.width;
  }

  // --- code --------------------------------------------------------------
  const numbers = [];
  const code = [];
  const carets = [];
  const rules = [];

  SOURCE.forEach((line, i) => {
    const y = TAB_H + TOP_PAD + (i + 1) * LINE - 8;
    const n = i + 1;

    numbers.push(
      `<text class="mono" x="${GUTTER}" y="${y}" text-anchor="end" font-size="13.5" fill="${syntax.muted}" fill-opacity="0.65">${n}</text>`,
    );

    const chars = line.length;
    const begin = START + i * STAGGER;

    if (!chars) return; // blank line: number only, nothing to reveal

    const spans = highlight(line)
      .map((token) =>
        token.color === null
          ? esc(token.text)
          : `<tspan fill="${token.color}">${esc(token.text)}</tspan>`,
      )
      .join('');

    code.push(
      `<text class="mono type l${n}" xml:space="preserve" x="${CODE_X}" y="${y}" font-size="${FONT}" fill="${syntax.text}">${spans}</text>`,
    );

    const dur = Math.min(chars * PER_CHAR, MAX_LINE_DUR);
    rules.push(`      .l${n} { animation: reveal ${dur.toFixed(2)}s steps(${chars}) ${begin.toFixed(2)}s backwards; }`);

    carets.push(
      `<rect class="caret c${n}" x="${CODE_X}" y="${(y - FONT + 3).toFixed(1)}" width="${(FONT * CHAR).toFixed(1)}" height="${FONT + 3}" fill="${syntax.blue}" fill-opacity="0.85"/>`,
    );
    rules.push(`      .c${n} { opacity: 0; animation: caret ${dur.toFixed(2)}s steps(1, end) ${begin.toFixed(2)}s forwards, walk${n} ${dur.toFixed(2)}s steps(${chars}) ${begin.toFixed(2)}s both; }`);
    rules.push(`      @keyframes walk${n} { to { transform: translateX(${monoWidth(line, FONT).toFixed(1)}px) } }`);
  });

  const finish = START + SOURCE.length * STAGGER + 0.3;

  // --- status bar --------------------------------------------------------
  const statusY = H - STATUS_H;
  const left = [
    { text: 'main', color: syntax.blue, icon: true },
    { text: '0 problems', color: syntax.green },
    { text: 'build passing', color: syntax.teal },
  ];

  let sx = 22;
  const leftItems = left
    .map((item) => {
      const markup = `<g>
      ${item.icon ? `<path d="M${sx} ${statusY + 21} v-8 M${sx} ${statusY + 13} a3 3 0 1 1 0.1 0 M${sx} ${statusY + 21} a3 3 0 1 0 0.1 0" stroke="${item.color}" stroke-width="1.4" fill="none" stroke-linecap="round"/>` : `<circle cx="${sx + 1}" cy="${statusY + STATUS_H / 2}" r="3.5" fill="${item.color}"/>`}
      <text class="mono" x="${sx + 12}" y="${statusY + STATUS_H / 2 + 4}" font-size="12" fill="${syntax.muted}">${esc(item.text)}</text>
    </g>`;
      sx += monoWidth(item.text, 12) + 40;
      return markup;
    })
    .join('\n    ');

  const right = 'TypeScript · UTF-8 · Ln 11, Col 2 · Spaces: 2';

  const body = `
  <!-- tab strip -->
  <path d="M0 8 a8 8 0 0 1 8 -8 h${W - 16} a8 8 0 0 1 8 8 v${TAB_H - 8} h-${W} z" fill="${bg.deep}"/>
  ${windowDots(26, TAB_H / 2, 5.5)}
  ${tabs.join('\n  ')}
  <line x1="0" y1="${TAB_H}" x2="${W}" y2="${TAB_H}" stroke="${bg.line}"/>

  <!-- gutter -->
  <rect x="0" y="${TAB_H}" width="${GUTTER + 12}" height="${CODE_H}" fill="${bg.deep}" fill-opacity="0.45"/>
  <g>
    ${numbers.join('\n    ')}
  </g>

  <!-- code -->
  <g>
    ${code.join('\n    ')}
  </g>
  <g>
    ${carets.join('\n    ')}
  </g>

  <!-- status bar -->
  <path d="M0 ${statusY} h${W} v${STATUS_H - 8} a8 8 0 0 1 -8 8 h-${W - 16} a8 8 0 0 1 -8 -8 z" fill="${bg.deep}"/>
  <line x1="0" y1="${statusY}" x2="${W}" y2="${statusY}" stroke="${bg.line}"/>
  <g class="fx status">
    ${leftItems}
    <text class="mono" x="${W - 22}" y="${statusY + STATUS_H / 2 + 4}" text-anchor="end" font-size="12" fill="${syntax.muted}">${esc(right)}</text>
  </g>`;

  return svg({
    width: W,
    height: H,
    title:
      "Ahmed Sha'ban — Software Engineer studying at Nile University and leading Abakera NU. Builds Flutter apps, Laravel APIs and realtime systems; exploring LLMs in production and Firebase Cloud. Ships finished products, not practice projects.",
    style: `
      /* The hidden state lives in the keyframe, not on the element: with
         'backwards' fill the line is clipped only while its animation is
         pending, so if animations never run the code is simply all there. */
      .caret { opacity: 0; }
      @keyframes reveal { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
      @keyframes caret  { 0%, 99% { opacity: 1 } 100% { opacity: 0 } }
      @keyframes appear { from { opacity: 0 } to { opacity: 1 } }
${rules.join('\n')}
      /* 'backwards', not a base opacity of 0: if the animation never runs the
         status bar stays visible instead of disappearing permanently. */
      .status { animation: appear .4s ease-out ${finish.toFixed(2)}s backwards; }`,
    body,
    background: bg.base,
  });
}

await writeFile(resolve(root, 'assets/hero.svg'), build(), 'utf8');
console.log(`assets/hero.svg — ${SOURCE.length} lines, ${W}x${H}`);
