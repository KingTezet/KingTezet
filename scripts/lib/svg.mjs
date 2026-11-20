// Shared SVG design system — mirrors the portfolio site
// (moch-sugih-nugraha-v2.vercel.app): warm off-white canvas, zinc scale,
// SF Pro / Inter display type with tight tracking, mono uppercase labels,
// rounded-3xl white cards, rounded-full pills, warm radial glow.
// Pure functions, no dependencies. Same input => same output.

export const THEMES = {
  light: {
    page: "#F5F5F4", // stone-100 (body)
    hero: "#FCFBFA", // hero canvas
    surface: "#FFFFFF",
    border: "#E4E4E7", // zinc-200
    text: "#18181B", // zinc-900
    body: "#52525B", // zinc-600
    label: "#71717A", // zinc-500
    faint: "#A1A1AA", // zinc-400
    pill: "#FAFAFA", // zinc-50
    invBg: "#18181B",
    invText: "#FAFAFA",
    invBody: "#A1A1AA",
    invBorder: "#27272A",
    glow: "#FFEBB9",
    glowOpacity: 0.55,
    gradFrom: "#18181B",
    gradTo: "#A1A1AA",
    accent: "#10B981",
  },
  dark: {
    page: "#0D0D0D",
    hero: "#0D0D0D",
    surface: "#18181B", // zinc-900
    border: "#27272A", // zinc-800
    text: "#FAFAFA",
    body: "#A1A1AA", // zinc-400
    label: "#71717A", // zinc-500
    faint: "#52525B",
    pill: "#1F1F22",
    invBg: "#FAFAFA",
    invText: "#18181B",
    invBody: "#52525B",
    invBorder: "#E4E4E7",
    glow: "#FFEBB9",
    glowOpacity: 0.1,
    gradFrom: "#FAFAFA",
    gradTo: "#71717A",
    accent: "#10B981",
  },
};

export const SANS = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, 'Segoe UI', Roboto, sans-serif";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const HAND = "'Shantell Sans', 'Chalkboard SE', 'Segoe Print', 'Bradley Hand', cursive";

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

/** Greedy word wrap by character budget; overflow folded into last line and clamped. */
export function wrap(str, maxChars, maxLines) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) line = next;
    else {
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

/** Rough advance-width estimate (px) for layout of pills/labels. */
export function measure(str, size, { mono = false, spacing = 0, weight = 400 } = {}) {
  const per = mono ? 0.6 : weight >= 600 ? 0.56 : 0.52;
  return String(str).length * (size * per + spacing);
}

export function text(x, y, content, { size = 14, weight = 400, fill, family = SANS, anchor, spacing, opacity } = {}) {
  const a = [`x="${x}"`, `y="${y}"`, `font-family="${esc(family)}"`, `font-size="${size}"`, `font-weight="${weight}"`, `fill="${fill}"`];
  if (anchor) a.push(`text-anchor="${anchor}"`);
  if (spacing !== undefined) a.push(`letter-spacing="${spacing}"`);
  if (opacity !== undefined) a.push(`fill-opacity="${opacity}"`);
  return `<text ${a.join(" ")}>${esc(content)}</text>`;
}

export function line(x1, y1, x2, y2, stroke, opacity) {
  const o = opacity !== undefined ? ` stroke-opacity="${opacity}"` : "";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1"${o}/>`;
}

export function rect(x, y, w, h, { fill = "none", stroke, rx = 0, opacity } = {}) {
  const s = stroke ? ` stroke="${stroke}" stroke-width="1"` : "";
  const o = opacity !== undefined ? ` fill-opacity="${opacity}"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${o}${s}/>`;
}

/** Rounded-full pill; returns { svg, width }. */
export function pill(x, y, label, { fill, stroke, color, size = 12, weight = 500, padX = 12, h = 26, dot } = {}) {
  const tw = measure(label, size, { weight });
  const dotW = dot ? 14 : 0;
  const w = Math.round(tw + padX * 2 + dotW);
  const parts = [rect(x, y, w, h, { fill, stroke, rx: h / 2 })];
  if (dot) parts.push(`<circle cx="${x + padX + 3}" cy="${y + h / 2}" r="3.5" fill="${dot}"/>`);
  parts.push(text(x + padX + dotW, y + h / 2 + size * 0.36, label, { size, weight, fill: color }));
  return { svg: parts.join(""), width: w };
}

/** Lay out pills left-to-right, dropping any that overflow maxWidth. */
export function pillRow(x, y, labels, maxWidth, opts) {
  const out = [];
  let cx = x;
  for (const l of labels) {
    const probe = pill(cx, y, l, opts);
    if (cx + probe.width > x + maxWidth) break;
    out.push(probe.svg);
    cx += probe.width + 8;
  }
  return out.join("\n");
}

/** Warm radial glow (portfolio hero motif). */
export function glowDef(id, t) {
  return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.glowOpacity}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>`;
}

/** Root document wrapper: rounded page background. */
export function doc({ width, height, id, title, desc, theme, defs = "", body, bg }) {
  const t = THEMES[theme];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${id}-title ${id}-desc">`,
    `<title id="${id}-title">${esc(title)}</title>`,
    `<desc id="${id}-desc">${esc(desc)}</desc>`,
    defs ? `<defs>${defs}</defs>` : "",
    rect(0, 0, width, height, { fill: bg ?? t.page, rx: 28 }),
    body,
    `</svg>`,
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Section header used by stack / projects / activity. */
export function sectionHeader(t, { eyebrow, title, aside, width = 1200 }) {
  return [
    text(48, 58, eyebrow.toUpperCase(), { size: 12, weight: 500, fill: t.label, family: MONO, spacing: 1.6 }),
    text(46, 106, title, { size: 42, weight: 500, fill: t.text, spacing: -1.4 }),
    aside ? text(width - 48, 106, aside.toUpperCase(), { size: 11, weight: 500, fill: t.label, family: MONO, anchor: "end", spacing: 1.6 }) : "",
  ].join("\n");
}
