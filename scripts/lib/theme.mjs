/**
 * Design tokens and SVG primitives shared by every generator in this repo.
 *
 * The palette is a manuscript one: lamp-black ink, gold leaf, and the two
 * pigments that show up in Mamluk-era illumination — verdigris and red ochre.
 * Every asset in /assets is drawn from these six values and nothing else.
 */

export const ink = {
  base: '#0B0F14', // page
  panel: '#10161E', // raised surface
  line: '#1C2531', // hairline rules on panels
};

export const pigment = {
  gold: '#C9A227', // headings, structure, the eye's first stop
  cream: '#F2E9D8', // body text
  verdigris: '#3FA79F', // secondary accent — frameworks, live values
  ochre: '#C4614F', // tertiary accent — tools, warnings
};

export const type = {
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace',
  arabic: '"Noto Naskh Arabic", "Amiri", "Traditional Arabic", "Segoe UI", Tahoma, serif',
};

/**
 * Tints of the three pigments, ordered so that any two neighbours in the list
 * are tellable apart. The language bar packs segments edge to edge, so equal
 * or near-equal neighbours would read as one block.
 */
export const tints = [
  '#3FA79F', // verdigris
  '#C9A227', // gold
  '#C4614F', // ochre
  '#6FC8C1', // verdigris, lifted
  '#E4C978', // gold, lifted
  '#D98E7E', // ochre, lifted
  '#2A7D77', // verdigris, deep
  '#8E7524', // gold, deep
];

/** Language → accent colour, fixed so a language keeps its colour between runs. */
export const langColor = {
  Dart: '#3FA79F',
  Python: '#6FC8C1',
  JavaScript: '#C9A227',
  TypeScript: '#2A7D77',
  HTML: '#C4614F',
  CSS: '#D98E7E',
  'C++': '#8E7524',
  C: '#8E7524',
  Java: '#E4C978',
  PHP: '#C4614F',
  Kotlin: '#6FC8C1',
  Swift: '#D98E7E',
  Shell: '#2A7D77',
  Other: '#4A5462',
};

/** Colour for a language, falling back to a stable tint for anything unmapped. */
export function colorFor(name, index = 0) {
  return langColor[name] ?? tints[index % tints.length];
}

/**
 * Escape a string for use as XML text or an attribute value.
 *
 * Descriptions come from the GitHub API, so they carry whatever an author
 * typed — ampersands and angle brackets included. Skipping this produces an
 * SVG that fails to parse and renders as a broken image on the profile.
 */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Approximate the rendered width of a monospace string, in user units.
 * Monospace advance width is a near-constant 0.60em across the stack above,
 * which is close enough to lay out panels without measuring real glyphs.
 */
export function monoWidth(text, fontSize) {
  return text.length * fontSize * 0.6;
}

/**
 * Break `text` into lines that fit `maxWidth` at `fontSize`, never exceeding
 * `maxLines`. The final line is ellipsised if there is anything left over.
 */
export function wrap(text, { fontSize, maxWidth, maxLines = 2 }) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (monoWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && line) lines.push(line);

  // If words remain unplaced, mark the truncation on the last line.
  const placed = lines.join(' ').split(/\s+/).length;
  if (placed < words.length && lines.length) {
    const last = lines[lines.length - 1];
    const room = Math.floor(maxWidth / (fontSize * 0.6)) - 1;
    lines[lines.length - 1] = `${last.slice(0, Math.max(0, room))}…`;
  }

  return lines.slice(0, maxLines);
}

/**
 * The 8-point star tessellation (khātim) used as a ground on every panel.
 * Returns a <pattern> definition; reference it with fill="url(#{id})".
 */
export function tessellation(id, { stroke = pigment.gold, size = 80 } = {}) {
  const s = size;
  const inset = s * 0.2625; // keeps the rotated square inside the tile
  const side = s * 0.475;
  const square = (x, y, cx, cy) =>
    `<rect x="${x}" y="${y}" width="${side}" height="${side}"/>` +
    `<rect x="${x}" y="${y}" width="${side}" height="${side}" transform="rotate(45 ${cx} ${cy})"/>`;

  return `<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse">
    <g fill="none" stroke="${stroke}" stroke-width="1">
      ${square(inset, inset, s / 2, s / 2)}
      ${square(-side / 2, -side / 2, 0, 0)}
      ${square(s - side / 2, -side / 2, s, 0)}
      ${square(-side / 2, s - side / 2, 0, s)}
      ${square(s - side / 2, s - side / 2, s, s)}
    </g>
  </pattern>`;
}

/** Corner registration marks, the kind used to align a printing plate. */
export function cornerMarks(w, h, { inset = 22, len = 20, opacity = 0.45 } = {}) {
  return `<g stroke="${pigment.gold}" stroke-opacity="${opacity}" stroke-width="1" fill="none">
    <path d="M${inset} ${inset} h${len} M${inset} ${inset} v${len}"/>
    <path d="M${w - inset} ${inset} h-${len} M${w - inset} ${inset} v${len}"/>
    <path d="M${inset} ${h - inset} h${len} M${inset} ${h - inset} v-${len}"/>
    <path d="M${w - inset} ${h - inset} h-${len} M${w - inset} ${h - inset} v-${len}"/>
  </g>`;
}

/**
 * A section rule: hairline with a small lozenge at the label end.
 * `label` is rendered in letterspaced mono, the house heading style.
 */
export function sectionRule(x, y, width, label) {
  const labelWidth = label ? monoWidth(label, 11) + label.length * 4 + 18 : 0;
  return `<g>
    ${label ? `<text x="${x}" y="${y + 4}" font-family='${type.mono}' font-size="11" letter-spacing="4" fill="${pigment.gold}" fill-opacity="0.85">${esc(label)}</text>` : ''}
    <line x1="${x + labelWidth}" y1="${y}" x2="${x + width}" y2="${y}" stroke="${pigment.gold}" stroke-opacity="0.22" stroke-width="1"/>
  </g>`;
}

/**
 * Motion is opt-in: anything animated must degrade to its final state when the
 * reader has asked for reduced motion. Every generator embeds this block.
 */
export const reducedMotion = `
  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; }
    .anim { opacity: 1 !important; transform: none !important; stroke-dashoffset: 0 !important; }
  }`;

/** Wrap body markup in a root <svg> with the house background and defs. */
export function svg({ width, height, title, defs = '', style = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <defs>
    ${defs}
    <style>
      .serif { font-family: ${type.serif}; }
      .mono  { font-family: ${type.mono}; }
      .ar    { font-family: ${type.arabic}; }
      ${style}
      ${reducedMotion}
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="${ink.base}"/>
${body}
</svg>
`;
}
