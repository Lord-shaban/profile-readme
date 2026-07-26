/**
 * Renders assets/terminal.svg — the hero panel.
 *
 * A shell session that types itself out. The typing is pure CSS: each line is
 * revealed by animating `clip-path: inset()` with a `steps(n)` timing function
 * where n is the character count, which lands the reveal on glyph boundaries
 * the way a real terminal does. Timings are computed here rather than
 * hand-tuned, so editing the script below cannot desynchronise the animation.
 *
 * No JavaScript runs in the output: GitHub renders README images inside <img>,
 * which blocks scripts but permits declarative CSS animation.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { esc, ink, pigment, svg } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1200;
const H = 368;
const FONT = 15;
const CW = FONT * 0.6; // monospace advance width
const LINE = 26;
const X0 = 34;
const TOP = 96;

const PROMPT = 'ahmed@nile ~ %';
const TYPE_SPEED = 0.05; // seconds per character
const AFTER_COMMAND = 0.3; // pause before output appears
const AFTER_OUTPUT = 0.45; // pause before the next prompt

/** The session. `cmd` lines are typed; `out` lines appear whole, as output does. */
const session = [
  { cmd: 'whoami' },
  { out: "Ahmed Sha'ban — software engineering student, Nile University.", accent: pigment.cream },
  { out: 'Team lead at Abakera NU.', accent: pigment.cream, dim: true },
  { gap: true },
  { cmd: 'cat focus.md' },
  { out: 'Laravel · Firebase Cloud · putting LLMs into products that ship.', accent: pigment.verdigris },
  { gap: true },
  { cmd: 'ls principles/' },
  { out: 'arabic-first/    rtl-from-day-one/    finished-over-clever/', accent: pigment.gold },
  { gap: true },
];

function build() {
  const lines = [];
  const keyframes = [];
  let t = 0.7; // let the window settle before the first keystroke
  let row = 0;
  let index = 0;

  for (const step of session) {
    const y = TOP + row * LINE;

    if (step.gap) {
      row += 1;
      continue;
    }

    if (step.cmd) {
      index += 1;
      const chars = step.cmd.length;
      const dur = +(chars * TYPE_SPEED).toFixed(2);
      const width = chars * CW;
      const cmdX = X0 + (PROMPT.length + 1) * CW;

      // The prompt lands just before its command starts typing, so the session
      // unfolds one line at a time instead of showing every prompt up front.
      lines.push(
        `  <text class="mono out p${index}" x="${X0}" y="${y}" font-size="${FONT}" fill="${pigment.verdigris}" fill-opacity="0.9">${esc(PROMPT)}</text>`,
      );
      keyframes.push(`      .p${index} { opacity: 0; animation: appear .18s ease-out ${Math.max(0, t - 0.2).toFixed(2)}s both; }`);
      lines.push(
        `  <text class="mono type t${index}" x="${cmdX}" y="${y}" font-size="${FONT}" fill="${pigment.cream}">${esc(step.cmd)}</text>`,
      );

      // Cursor: a block that walks one character per step, in lockstep with
      // the reveal above, then hands off to the next line.
      lines.push(`  <g class="cur k${index}">
    <rect class="walk w${index}" x="${cmdX}" y="${(y - FONT + 2).toFixed(1)}" width="${CW.toFixed(1)}" height="${FONT + 2}" fill="${pigment.gold}" fill-opacity="0.85"/>
  </g>`);

      keyframes.push(`      .t${index} { animation: reveal ${dur}s steps(${chars}) ${t.toFixed(2)}s both; }`);
      // One animation, not two: stacking `show` and `hide` on the same property
      // leaves the resting opacity up to fill-mode precedence, which browsers
      // resolve inconsistently. A single keyframe set is unambiguous.
      keyframes.push(`      .k${index} { opacity: 0; animation: caret ${dur}s steps(1, end) ${t.toFixed(2)}s forwards; }`);
      keyframes.push(`      .w${index} { animation: walk${index} ${dur}s steps(${chars}) ${t.toFixed(2)}s both; }`);
      keyframes.push(`      @keyframes walk${index} { to { transform: translateX(${width.toFixed(1)}px) } }`);

      t += dur + AFTER_COMMAND;
      row += 1;
      continue;
    }

    // Output line.
    index += 1;
    lines.push(
      `  <text class="mono out o${index}" x="${X0}" y="${y}" font-size="${FONT}" fill="${step.accent}" fill-opacity="${step.dim ? 0.55 : 0.82}">${esc(step.out)}</text>`,
    );
    keyframes.push(`      .o${index} { opacity: 0; animation: appear .28s ease-out ${t.toFixed(2)}s both; }`);

    t += AFTER_OUTPUT;
    row += 1;
  }

  // Resting prompt with a cursor that blinks once the session finishes.
  const restY = TOP + (row - 1) * LINE;
  lines.push(`  <text class="mono rest" x="${X0}" y="${restY}" font-size="${FONT}" fill="${pigment.verdigris}" fill-opacity="0.9">${esc(PROMPT)}</text>`);
  lines.push(
    `  <rect class="blink" x="${(X0 + (PROMPT.length + 1) * CW).toFixed(1)}" y="${(restY - FONT + 2).toFixed(1)}" width="${CW.toFixed(1)}" height="${FONT + 2}" fill="${pigment.gold}"/>`,
  );
  keyframes.push(`      .rest { opacity: 0; animation: appear .2s linear ${t.toFixed(2)}s both; }`);
  keyframes.push(`      .blink { opacity: 0; animation: blink 1.06s steps(1) ${t.toFixed(2)}s infinite; }`);

  const dots = [pigment.ochre, pigment.gold, pigment.verdigris]
    .map((c, i) => `<circle cx="${34 + i * 20}" cy="34" r="5.5" fill="${c}" fill-opacity="0.75"/>`)
    .join('\n    ');

  const body = `
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="3" fill="${ink.panel}" stroke="${pigment.gold}" stroke-opacity="0.30"/>

  <!-- title bar -->
  <path d="M0.5 3 a2.5 2.5 0 0 1 2.5 -2.5 h${W - 6} a2.5 2.5 0 0 1 2.5 2.5 v57 h-${W - 1} z" fill="${ink.base}" fill-opacity="0.55"/>
  <line x1="0.5" y1="60" x2="${W - 0.5}" y2="60" stroke="${pigment.gold}" stroke-opacity="0.22"/>
  <g>
    ${dots}
  </g>
  <text class="mono" x="${W / 2}" y="39" text-anchor="middle" font-size="12" letter-spacing="2" fill="${pigment.cream}" fill-opacity="0.45">ahmed sha&#8217;ban — profile.sh</text>
  <text class="ar" x="${W - 34}" y="40" text-anchor="end" font-size="15" fill="${pigment.gold}" fill-opacity="0.75">أحمد شعبان</text>

${lines.join('\n')}`;

  return svg({
    width: W,
    height: H,
    title: "Ahmed Sha'ban — software engineering student at Nile University; focused on Laravel, Firebase Cloud and shipping LLM-powered products; builds Arabic-first",
    style: `
      .type { clip-path: inset(0 100% 0 0); }
      @keyframes reveal { to { clip-path: inset(0 0 0 0) } }
      @keyframes appear { from { opacity: 0 } to { opacity: 1 } }
      @keyframes caret  { 0%, 99% { opacity: 1 } 100% { opacity: 0 } }
      @keyframes blink  { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
${keyframes.join('\n')}

      @media (prefers-reduced-motion: reduce) {
        .type { clip-path: none !important; }
        .cur  { display: none !important; }
        .out, .rest, .blink { opacity: 1 !important; }
      }`,
    body,
  });
}

await writeFile(resolve(root, 'assets/terminal.svg'), build(), 'utf8');
console.log('assets/terminal.svg');
