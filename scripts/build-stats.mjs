/**
 * Renders assets/stats.svg — the numbers panel.
 *
 * Exists so the profile depends on no third-party card service: nothing to
 * rate-limit, nothing to go down, and the result sits in the same palette as
 * every other asset. A scheduled workflow re-runs it daily.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchProfile } from './lib/github.mjs';
import { bg, colorFor, esc, monoWidth, svg, syntax } from './lib/theme.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const W = 1200;
const H = 268;
const PAD = 24;
const GAP = 12;

const group = (n) => n.toLocaleString('en-US');

function tile(x, width, { value, label, accent }, delay) {
  return `<g class="fx pop" style="animation-delay:${delay.toFixed(2)}s">
    <rect x="${x.toFixed(1)}" y="24" width="${width.toFixed(1)}" height="98" rx="9" fill="${bg.panel}" stroke="${bg.line}"/>
    <rect x="${x.toFixed(1)}" y="24" width="${width.toFixed(1)}" height="3" rx="1.5" fill="${accent}" fill-opacity="0.85"/>
    <text class="sans" x="${(x + width / 2).toFixed(1)}" y="79" text-anchor="middle" font-size="34" font-weight="600" fill="${accent}">${esc(value)}</text>
    <text class="mono" x="${(x + width / 2).toFixed(1)}" y="102" text-anchor="middle" font-size="10" letter-spacing="1.6" fill="${syntax.muted}">${esc(label)}</text>
  </g>`;
}

function build(profile) {
  const stats = [
    { value: group(profile.repoCount), label: 'REPOSITORIES', accent: syntax.blue },
    { value: group(profile.stars), label: 'STARS EARNED', accent: syntax.yellow },
    { value: group(profile.contributions), label: 'CONTRIBUTIONS · 1Y', accent: syntax.green },
    { value: group(profile.pullRequests), label: 'PULL REQUESTS', accent: syntax.purple },
    { value: group(profile.issues), label: 'ISSUES', accent: syntax.cyan },
    { value: group(profile.followers), label: 'FOLLOWERS', accent: syntax.orange },
  ];

  const tileWidth = (W - PAD * 2 - GAP * (stats.length - 1)) / stats.length;
  const tiles = stats
    .map((s, i) => tile(PAD + i * (tileWidth + GAP), tileWidth, s, 0.05 * i))
    .join('\n  ');

  // Language bar: top 6 by bytes written, remainder folded into "Other".
  const top = profile.languages.slice(0, 6);
  const rest = profile.languages.slice(6).reduce((sum, l) => sum + l.share, 0);
  const segments = rest > 0.001 ? [...top, { name: 'Other', share: rest }] : top;

  const barY = 176;
  const barH = 14;
  const barW = W - PAD * 2;

  let cursor = PAD;
  const bars = segments
    .map((lang, i) => {
      const width = lang.share * barW;
      const rect = `<rect x="${cursor.toFixed(2)}" y="${barY}" width="${Math.max(0, width - 2).toFixed(2)}" height="${barH}" fill="${colorFor(lang.name, i)}"/>`;
      cursor += width;
      return rect;
    })
    .join('\n    ');

  let legendX = PAD;
  const legend = segments
    .map((lang, i) => {
      const color = colorFor(lang.name, i);
      const label = `${lang.name} ${(lang.share * 100).toFixed(1)}%`;
      const markup = `<g>
      <circle cx="${legendX + 4}" cy="${barY + 44}" r="4.5" fill="${color}"/>
      <text class="mono" x="${legendX + 16}" y="${barY + 48}" font-size="11.5" fill="${syntax.muted}">${esc(label)}</text>
    </g>`;
      legendX += monoWidth(label, 11.5) + 40;
      return markup;
    })
    .join('\n    ');

  const stamp = new Date().toISOString().slice(0, 10);

  const body = `
  ${tiles}

  <text class="mono" x="${PAD}" y="${barY - 14}" font-size="11" letter-spacing="1.6" fill="${syntax.muted}">LANGUAGES BY BYTES WRITTEN</text>

  <rect x="${PAD}" y="${barY}" width="${barW}" height="${barH}" rx="7" fill="${bg.panel}"/>
  <g clip-path="url(#rounded)">
    <g class="fx sweep">
      ${bars}
    </g>
  </g>
  <g class="fx fade">
    ${legend}
  </g>

  <text class="mono" x="${W - PAD}" y="${H - 14}" text-anchor="end" font-size="10" fill="${syntax.muted}" fill-opacity="0.7">generated ${stamp} · scripts/build-stats.mjs</text>`;

  return svg({
    width: W,
    height: H,
    title: `GitHub statistics for ${profile.login}: ${profile.repoCount} repositories, ${profile.stars} stars, ${profile.contributions} contributions in the last year`,
    defs: `<clipPath id="rounded"><rect x="${PAD}" y="${barY}" width="${barW}" height="${barH}" rx="7"/></clipPath>`,
    style: `
      .pop  { animation: pop .5s cubic-bezier(.2,.7,.3,1) backwards; }
      .fade { animation: fade .5s ease-out 1.1s backwards; }
      /* The bar wipes in with a CSS transform rather than an animated clip:
         SMIL ignores prefers-reduced-motion, so a SMIL sweep would keep
         moving — or freeze at zero width — for readers who opted out. */
      .sweep {
        transform-box: view-box;
        transform-origin: ${PAD}px ${barY}px;
        animation: sweep .9s cubic-bezier(.2,.7,.3,1) .3s backwards;
      }
      @keyframes pop   { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
      @keyframes fade  { from { opacity: 0 } to { opacity: 1 } }
      @keyframes sweep { from { transform: scaleX(0) } to { transform: scaleX(1) } }`,
    body,
    background: bg.base,
  });
}

const manifest = JSON.parse(await readFile(resolve(root, 'data/projects.json'), 'utf8'));
const profile = await fetchProfile(manifest.owner);

await writeFile(resolve(root, 'assets/stats.svg'), build(profile), 'utf8');

console.log(
  `assets/stats.svg — ${profile.repoCount} repos, ${profile.stars} stars, ` +
    `${profile.contributions} contributions, top language ${profile.languages[0]?.name}`,
);
