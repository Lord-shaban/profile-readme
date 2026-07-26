/**
 * A very small syntax highlighter — just enough TypeScript to colour the hero.
 *
 * Shipping a real grammar would mean a dependency and a parse tree for six
 * lines of code. This scans a restricted subset with an ordered rule list,
 * which is exact for the input in build-hero.mjs and degrades to plain
 * foreground text for anything it does not recognise.
 */

import { syntax } from './theme.mjs';

const KEYWORDS = /^(?:const|let|var|function|return|export|import|from|as|new|await|async|class|interface|type|extends|implements|readonly|satisfies|if|else|for|of|in)\b/;
const CONSTANTS = /^(?:true|false|null|undefined|this)\b/;

/**
 * Ordered scanner rules. Order is the grammar: `property` must be tried
 * before `identifier`, and `comment` before `punct`, or `//` reads as two
 * division operators.
 */
const RULES = [
  ['comment', /^\/\/[^\n]*/, syntax.muted],
  ['string', /^(['"`])(?:\\.|(?!\1)[^\\])*\1/, syntax.green],
  ['number', /^\d+(?:\.\d+)?/, syntax.orange],
  ['keyword', KEYWORDS, syntax.purple],
  ['constant', CONSTANTS, syntax.orange],
  ['property', /^[A-Za-z_$][\w$]*(?=\s*:)/, syntax.cyan],
  ['call', /^[A-Za-z_$][\w$]*(?=\s*\()/, syntax.blue],
  ['identifier', /^[A-Za-z_$][\w$]*/, syntax.text],
  ['space', /^\s+/, null],
  ['punct', /^[^\w\s]/, syntax.muted],
];

/**
 * Tokenise one line into `{ text, color }` runs.
 * `color: null` marks whitespace, which callers render without a fill.
 */
export function highlight(line) {
  const tokens = [];
  let rest = line;

  while (rest.length) {
    let matched = false;

    for (const [, pattern, color] of RULES) {
      const match = pattern.exec(rest);
      if (!match || match.index !== 0 || match[0] === '') continue;

      const text = match[0];
      const previous = tokens[tokens.length - 1];

      // Merge adjacent runs of the same colour so the output carries one
      // <tspan> per visual run instead of one per token.
      if (previous && previous.color === color) previous.text += text;
      else tokens.push({ text, color });

      rest = rest.slice(text.length);
      matched = true;
      break;
    }

    // Unknown character: emit it as plain foreground rather than looping.
    if (!matched) {
      tokens.push({ text: rest[0], color: syntax.text });
      rest = rest.slice(1);
    }
  }

  return tokens;
}
