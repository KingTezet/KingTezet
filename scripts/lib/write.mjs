import { writeFile, rename, rm } from "node:fs/promises";

const FORBIDDEN = /<\s*(script|foreignObject)\b|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:(?!image\/(?:jpeg|png|webp);base64,))/i;

/** Lightweight pre-write sanity check. Full XML validation runs in validate-svg.py. */
export function assertSvg(name, svg) {
  if (!svg.startsWith("<svg ") || !svg.trimEnd().endsWith("</svg>")) {
    throw new Error(`${name}: malformed SVG envelope`);
  }
  if (/undefined|NaN|\[object /.test(svg.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, ""))) throw new Error(`${name}: unresolved value in output`);
  if (FORBIDDEN.test(svg)) throw new Error(`${name}: forbidden SVG content`);
  const open = (svg.match(/<text\b/g) || []).length;
  const close = (svg.match(/<\/text>/g) || []).length;
  if (open !== close) throw new Error(`${name}: unbalanced <text> elements`);
}

/**
 * Write several files atomically as a group: all temp files are written and
 * checked first, then renamed. On failure, temp files are removed and the
 * previous assets stay untouched.
 */
export async function writeAllAtomic(entries) {
  const temps = [];
  try {
    for (const { path, content } of entries) {
      assertSvg(path, content);
      const tmp = `${path}.tmp-${process.pid}`;
      await writeFile(tmp, content, "utf8");
      temps.push({ tmp, path });
    }
    for (const { tmp, path } of temps) await rename(tmp, path);
  } catch (err) {
    await Promise.all(temps.map(({ tmp }) => rm(tmp, { force: true })));
    throw err;
  }
}
