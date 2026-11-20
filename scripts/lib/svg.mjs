// Shared SVG design system: tokens, escaping, text helpers.
// Pure functions, no dependencies. Same input => same output.

export const THEMES = {
  dark: {
    canvas: "#09090B",
    text: "#FAFAFA",
    muted: "#A1A1AA",
    border: "#27272A",
    surface: "#111113",
    grid: "#202024",
    accent: "#10B981",
  },
  light: {
    canvas: "#FAFAFA",
    text: "#09090B",
    muted: "#71717A",
    border: "#E4E4E7",
    surface: "#FFFFFF",
    grid: "#EEEEF0",
    accent: "#10B981",
  },
};

export const SANS = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Truncate to max characters, appending an ellipsis when cut. */
export function clamp(value, max) {
  const s = String(value);
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/** Greedy word wrap by character budget; last line clamped. */
export function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = clamp(kept[maxLines - 1] + " " + lines.slice(maxLines).join(" "), maxChars);
    return kept;
  }
  return lines.map((l) => clamp(l, maxChars));
}

/** Text element. attrs: object of extra attributes. */
export function text(x, y, content, { size = 14, weight = 400, fill, family = SANS, anchor, spacing } = {}) {
  const a = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${esc(family)}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
  ];
  if (anchor) a.push(`text-anchor="${anchor}"`);
  if (spacing !== undefined) a.push(`letter-spacing="${spacing}"`);
  return `<text ${a.join(" ")}>${esc(content)}</text>`;
}

export function line(x1, y1, x2, y2, stroke) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1"/>`;
}

export function rect(x, y, w, h, { fill = "none", stroke, rx = 0 } = {}) {
  const s = stroke ? ` stroke="${stroke}" stroke-width="1"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${s}/>`;
}

/** Root document wrapper with outer frame. */
export function doc({ width, height, id, title, desc, theme, body }) {
  const t = THEMES[theme];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc">`,
    `<title id="${id}-title">${esc(title)}</title>`,
    `<desc id="${id}-desc">${esc(desc)}</desc>`,
    rect(0.5, 0.5, width - 1, height - 1, { fill: t.canvas, stroke: t.border, rx: 12 }),
    body,
    `</svg>`,
    "",
  ].join("\n");
}
