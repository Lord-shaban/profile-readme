/**
 * Design tokens and SVG primitives shared by every generator in this repo.
 *
 * The whole page is styled as an editor. Colours are a Tokyo Night–style
 * syntax palette, so a reader who writes code recognises the vocabulary
 * immediately: keywords, strings, numbers and comments each keep the hue
 * they would have in a real theme, everywhere they appear.
 */

export const bg = {
  deep: '#16161E', // chrome — tab strip, gutter, status bar
  base: '#1A1B26', // editor background
  panel: '#1F2335', // raised surface — cards, popovers
  line: '#292E42', // dividers, borders
  active: '#24283B', // current-line highlight, hover fills
};

export const syntax = {
  text: '#C0CAF5', // default foreground
  muted: '#565F89', // comments, line numbers, de-emphasised text
  blue: '#7AA2F7', // functions, headings
  purple: '#BB9AF7', // keywords
  cyan: '#7DCFFF', // properties, tags
  green: '#9ECE6A', // strings
  orange: '#FF9E64', // numbers, constants
  red: '#F7768E', // errors, punctuation accents
  yellow: '#E0AF68', // types, warnings
  teal: '#73DACA', // operators, success
};

export const type = {
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace',
  sans: 'ui-sans-serif, system-ui, "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

/** Monospace advance width is a near-constant 0.6em across the stack above. */
export const CHAR = 0.6;
export const monoWidth = (text, size) => text.length * size * CHAR;

/** Language → the colour it gets in the language bar and on cards. */
export const langColor = {
  Dart: '#7DCFFF',
  JavaScript: '#E0AF68',
  TypeScript: '#7AA2F7',
  Python: '#9ECE6A',
  HTML: '#FF9E64',
  CSS: '#BB9AF7',
  SCSS: '#BB9AF7',
  Java: '#F7768E',
  Kotlin: '#BB9AF7',
  Swift: '#FF9E64',
  'C++': '#73DACA',
  C: '#73DACA',
  PHP: '#7AA2F7',
  Ruby: '#F7768E',
  Shell: '#9ECE6A',
  Vue: '#73DACA',
  Other: '#565F89',
};

const fallback = ['#7AA2F7', '#BB9AF7', '#7DCFFF', '#9ECE6A', '#E0AF68', '#F7768E', '#73DACA', '#FF9E64'];

/** Colour for a language, stable across runs, distinct from its neighbours. */
export function colorFor(name, index = 0) {
  return langColor[name] ?? fallback[index % fallback.length];
}

/** Escape a string for use as XML text or an attribute value. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Break `text` into at most `maxLines` lines that fit `maxWidth`, ellipsising
 * the last line if anything is left over.
 */
export function wrap(text, { fontSize, maxWidth, maxLines = 2 }) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let line = '';
  let used = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (monoWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      used += line.split(/\s+/).length;
    }
    line = word;
    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && line) {
    lines.push(line);
    used += line.split(/\s+/).length;
  }

  if (used < words.length && lines.length) {
    const room = Math.max(0, Math.floor(maxWidth / (fontSize * CHAR)) - 1);
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, room)}…`;
  }

  return lines.slice(0, maxLines);
}

/** Traffic-light dots, drawn once so every window in the page matches. */
export function windowDots(x, y, r = 6) {
  return [syntax.red, syntax.yellow, syntax.green]
    .map((c, i) => `<circle cx="${x + i * (r * 3)}" cy="${y}" r="${r}" fill="${c}" fill-opacity="0.9"/>`)
    .join('');
}

/** A soft glow behind an accent element, for depth without a drop shadow. */
export function glow(id, color) {
  return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
  </radialGradient>`;
}

/**
 * Motion is opt-in: anything animated must land on its final frame when the
 * reader has asked for reduced motion.
 */
export const reducedMotion = `
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
    .anim, .fx { opacity: 1 !important; transform: none !important; clip-path: none !important; }
  }`;

/** Wrap body markup in a root <svg> with the editor background and defs. */
export function svg({ width, height, title, defs = '', style = '', body, background = bg.base }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <defs>
    ${defs}
    <style>
      .mono { font-family: ${type.mono}; }
      .sans { font-family: ${type.sans}; }
      ${style}
      ${reducedMotion}
    </style>
  </defs>
  <rect width="${width}" height="${height}" rx="8" fill="${background}"/>
${body}
</svg>
`;
}
