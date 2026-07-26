/**
 * Renders assets/stats.svg — the profile's numbers, drawn in-house.
 *
 * This exists so the profile does not depend on a third-party card service:
 * nothing to rate-limit, nothing to go down, and the result sits in the same
 * palette as every other asset. A scheduled workflow re-runs it daily.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchProfile } from './lib/github.mjs';
import { colorFor, cornerMarks, esc, pigment, sectionRule, svg, tessellation } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1200;
const H = 320;
const PAD = 28;

/** 1234 → "1,234". Keeps big numbers readable at a glance. */
const group = (n) => n.toLocaleString('en-US');

function statCell(x, width, value, label, accent) {
  return `<g>
    <text class="serif" x="${x + width / 2}" y="112" text-anchor="middle" font-size="46" fill="${accent}">${esc(value)}</text>
    <text class="mono" x="${x + width / 2}" y="138" text-anchor="middle" font-size="10" letter-spacing="3" fill="${pigment.cream}" fill-opacity="0.55">${esc(label)}</text>
  </g>`;
}

function build(profile) {
  const stats = [
    { value: group(profile.repoCount), label: 'REPOSITORIES', accent: pigment.gold },
    { value: group(profile.stars), label: 'STARS EARNED', accent: pigment.gold },
    { value: group(profile.contributions), label: 'CONTRIBUTIONS · 1Y', accent: pigment.verdigris },
    { value: group(profile.pullRequests), label: 'PULL REQUESTS', accent: pigment.verdigris },
    { value: group(profile.issues), label: 'ISSUES', accent: pigment.ochre },
    { value: group(profile.followers), label: 'FOLLOWERS', accent: pigment.ochre },
  ];

  const cellWidth = (W - PAD * 2) / stats.length;
  const cells = stats
    .map((s, i) => statCell(PAD + i * cellWidth, cellWidth, s.value, s.label, s.accent))
    .join('\n  ');

  // Dividers between stat cells, short and hairline so they group without boxing.
  const dividers = stats
    .slice(1)
    .map(
      (_, i) =>
        `<line x1="${PAD + (i + 1) * cellWidth}" y1="76" x2="${PAD + (i + 1) * cellWidth}" y2="144" stroke="${pigment.gold}" stroke-opacity="0.16"/>`,
    )
    .join('\n  ');

  // Language bar: top 6 by bytes written, remainder folded into "Other".
  const top = profile.languages.slice(0, 6);
  const rest = profile.languages.slice(6).reduce((sum, l) => sum + l.share, 0);
  const segments = rest > 0.001 ? [...top, { name: 'Other', share: rest }] : top;

  const barX = PAD;
  const barY = 210;
  const barW = W - PAD * 2;
  const barH = 16;

  let cursor = barX;
  const bars = segments
    .map((lang, i) => {
      const width = lang.share * barW;
      const rect = `<rect x="${cursor.toFixed(2)}" y="${barY}" width="${Math.max(0, width - 2).toFixed(2)}" height="${barH}" fill="${colorFor(lang.name, i)}" fill-opacity="0.9"/>`;
      cursor += width;
      return rect;
    })
    .join('\n    ');

  let legendX = PAD;
  const legend = segments
    .map((lang, i) => {
      const color = colorFor(lang.name, i);
      const text = `${lang.name} ${(lang.share * 100).toFixed(1)}%`;
      const item = `<g>
      <rect x="${legendX}" y="${barY + 40}" width="9" height="9" fill="${color}" fill-opacity="0.85"/>
      <text class="mono" x="${legendX + 16}" y="${barY + 49}" font-size="11" fill="${pigment.cream}" fill-opacity="0.72">${esc(text)}</text>
    </g>`;
      legendX += text.length * 6.6 + 34;
      return item;
    })
    .join('\n    ');

  const stamp = new Date().toISOString().slice(0, 10);

  const body = `
  <rect width="${W}" height="${H}" fill="url(#ground)" opacity="0.08"/>

  ${sectionRule(PAD, 40, W - PAD * 2, 'BY THE NUMBERS')}

  <g class="anim rise">
  ${cells}
  ${dividers}
  </g>

  ${sectionRule(PAD, 182, W - PAD * 2, 'WHAT I WRITE IN')}

  <g clip-path="url(#sweep)">
    ${bars}
  </g>
  <g class="anim fade">
    ${legend}
  </g>

  <text class="mono" x="${W - PAD}" y="${H - 16}" text-anchor="end" font-size="9.5" letter-spacing="2" fill="${pigment.cream}" fill-opacity="0.32">GENERATED ${stamp} · SCRIPTS/BUILD-STATS.MJS</text>

  ${cornerMarks(W, H)}`;

  return svg({
    width: W,
    height: H,
    title: `GitHub statistics for ${profile.login}: ${profile.repoCount} repositories, ${profile.stars} stars, ${profile.commits} commits in the last year`,
    defs: `${tessellation('ground', { size: 80 })}
    <clipPath id="sweep">
      <rect x="${barX}" y="${barY}" height="${barH}" width="0">
        <animate attributeName="width" from="0" to="${barW}" dur="1.1s" begin="0.3s" fill="freeze" calcMode="spline" keySplines="0.2 0.7 0.3 1"/>
      </rect>
    </clipPath>`,
    style: `
      .rise { opacity: 0; transform: translateY(8px); animation: rise .7s cubic-bezier(.2,.7,.3,1) .1s forwards; }
      .fade { opacity: 0; animation: fade .6s ease-out 1.1s forwards; }
      @keyframes rise { to { opacity: 1; transform: translateY(0) } }
      @keyframes fade { to { opacity: 1 } }`,
    body,
  });
}

const manifest = JSON.parse(await readFile(resolve(root, 'data/projects.json'), 'utf8'));
const profile = await fetchProfile(manifest.owner);

await writeFile(resolve(root, 'assets/stats.svg'), build(profile), 'utf8');

console.log(
  `assets/stats.svg — ${profile.repoCount} repos, ${profile.stars} stars, ${profile.commits} commits, ` +
    `${profile.languages.length} languages (top: ${profile.languages[0]?.name})`,
);
