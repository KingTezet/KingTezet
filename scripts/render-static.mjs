// Renders the static profile components (hero, stack, projects) in dark and
// light variants from scripts/profile.config.json. Raster images are
// embedded as data URIs so the SVGs stay self-contained (no remote fetches).
// Usage: npm run render:static
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  THEMES, SANS, MONO, HAND, esc, doc, text, line, rect, wrap, pill, pillRow, glowDef, sectionHeader,
} from "./lib/svg.mjs";
import { writeAllAtomic } from "./lib/write.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "svg");
const config = JSON.parse(await readFile(path.join(ROOT, "scripts", "profile.config.json"), "utf8"));

async function dataUri(rel) {
  const buf = await readFile(path.join(ROOT, rel));
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const photo = await dataUri(config.profile.photo);
const covers = {};
for (const p of config.projects) if (p.cover) covers[p.id] = await dataUri(p.cover);

// ---------------------------------------------------------------- hero
function hero(theme) {
  const t = THEMES[theme];
  const p = config.profile;
  const W = 1200, H = 440;
  const id = `hero-${theme}`;
  const defs = [
    `<clipPath id="${id}-clip"><rect x="0" y="0" width="${W}" height="${H}" rx="28"/></clipPath>`,
    glowDef(`${id}-glow`, t),
    `<linearGradient id="${id}-fadeL" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.hero}" stop-opacity="1"/><stop offset="1" stop-color="${t.hero}" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="${id}-fadeB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.hero}" stop-opacity="0"/><stop offset="1" stop-color="${t.hero}" stop-opacity="1"/></linearGradient>`,
    `<linearGradient id="${id}-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.gradFrom}"/><stop offset="1" stop-color="${t.gradTo}"/></linearGradient>`,
  ].join("");

  const b = [];
  b.push(`<g clip-path="url(#${id}-clip)">`);
  // portrait, right side, fading into the canvas (portfolio hero treatment)
  const px = 790, pw = 400, ph = 440;
  b.push(`<image x="${px}" y="0" width="${pw}" height="${ph}" preserveAspectRatio="xMidYMin slice" href="${photo}"/>`);
  b.push(rect(px - 1, 0, 150, ph, { fill: `url(#${id}-fadeL)` }));
  b.push(rect(px, ph - 120, pw + 20, 120, { fill: `url(#${id}-fadeB)` }));
  if (theme === "dark") b.push(rect(px, 0, pw + 20, ph, { fill: t.hero, opacity: 0.25 }));
  b.push(`<ellipse cx="880" cy="220" rx="460" ry="300" fill="url(#${id}-glow)"/>`);
  b.push(`</g>`);

  b.push(text(50, 92, "hi, i’m", { size: 30, weight: 300, fill: t.text, family: HAND }));
  b.push(text(45, 160, p.name, { size: 58, weight: 600, fill: t.text, spacing: -2.2 }));
  b.push(text(48, 198, p.eyebrow.toUpperCase(), { size: 12, weight: 500, fill: t.label, family: MONO, spacing: 2.2 }));
  b.push(line(48, 222, 660, 222, t.border));
  b.push(text(46, 270, p.headline[0], { size: 34, weight: 500, fill: t.text, spacing: -1.1 }));
  b.push(
    `<text x="46" y="310" font-family="${esc(SANS)}" font-size="34" font-weight="500" letter-spacing="-1.1" fill="url(#${id}-grad)">${esc(p.headline[1])}</text>`,
  );

  const a = pill(48, 352, p.availability, { fill: t.invBg, color: t.invText, size: 13, padX: 18, h: 38, dot: t.accent });
  b.push(a.svg);
  b.push(pill(48 + a.width + 10, 352, p.markets.join(" · "), { fill: t.surface, stroke: t.border, color: t.text, size: 13, padX: 18, h: 38 }).svg);

  return doc({
    width: W, height: H, id, theme, defs, bg: t.hero,
    title: `${p.name} — ${p.role}`,
    desc: `${p.headline.join(" ")} ${p.eyebrow}. ${p.availability}: ${p.markets.join(", ")}.`,
    body: b.join("\n"),
  });
}

// ---------------------------------------------------------------- stack
function stack(theme) {
  const t = THEMES[theme];
  const W = 1200, H = 310;
  const b = [sectionHeader(t, { eyebrow: "Capabilities", title: "Tools I ship with.", aside: `${config.stack.length} groups · frontend-led` })];
  const colW = 264, gap = 16, top = 136, h = 146;
  config.stack.forEach((g, i) => {
    const x = 48 + i * (colW + gap);
    const inv = g.primary;
    b.push(rect(x, top, colW, h, { fill: inv ? t.invBg : t.surface, stroke: inv ? undefined : t.border, rx: 24 }));
    b.push(text(x + 22, top + 36, `${g.index} — ${g.title.toUpperCase()}`, { size: 11, weight: 500, fill: inv ? t.invBody : t.label, family: MONO, spacing: 1.4 }));
    if (inv) b.push(`<circle cx="${x + colW - 26}" cy="${top + 32}" r="3.5" fill="${t.accent}"/>`);
    // flowing pills, max two rows
    let cx = x + 22, cy = top + 58, row = 0;
    for (const item of g.items) {
      const opts = {
        fill: inv ? "none" : t.pill, stroke: inv ? t.invBorder : t.border, color: inv ? t.invText : t.body,
        size: 12, padX: 12, h: 28,
      };
      let pl = pill(cx, cy, item, opts);
      if (cx + pl.width > x + colW - 22) {
        row++;
        if (row > 1) break;
        cx = x + 22;
        cy += 36;
        pl = pill(cx, cy, item, opts);
      }
      b.push(pl.svg);
      cx += pl.width + 8;
    }
  });
  return doc({
    width: W, height: H, id: `stack-${theme}`, theme,
    title: "Core technology stack",
    desc: config.stack.map((g) => `${g.title}: ${g.items.join(", ")}`).join(". ") + ".",
    body: b.join("\n"),
  });
}

// ---------------------------------------------------------------- projects
function typographicCover(t, theme, p, x, y, w, h, cid) {
  const bg = theme === "dark" ? "#09090B" : "#18181B";
  const out = [rect(x, y, w, h, { fill: bg })];
  for (let gx = x + 32; gx < x + w; gx += 32) out.push(line(gx, y, gx, y + h, "#FFFFFF", 0.05));
  for (let gy = y + 32; gy < y + h; gy += 32) out.push(line(x, gy, x + w, gy, "#FFFFFF", 0.05));
  out.push(`<ellipse cx="${x + w * 0.8}" cy="${y + h * 0.2}" rx="${w * 0.55}" ry="${h * 0.7}" fill="url(#${cid})"/>`);
  out.push(text(x + 30, y + h - 52, p.name, { size: 60, weight: 600, fill: "#FFFFFF", spacing: -2.4 }));
  out.push(text(x + 32, y + h - 24, p.subtitle, { size: 14, weight: 400, fill: "#A1A1AA" }));
  return out.join("\n");
}

function projects(theme) {
  const t = THEMES[theme];
  const W = 1200;
  const cw = 540, gap = 24, coverH = 290, bodyH = 196, ch = coverH + bodyH, top = 136;
  const list = config.projects.filter((p) => p.featured).slice(0, 4);
  const H = top + 2 * ch + gap + 48;
  const id = `projects-${theme}`;
  const defs = [
    `<radialGradient id="${id}-warm" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFEBB9" stop-opacity="0.18"/><stop offset="1" stop-color="#FFEBB9" stop-opacity="0"/></radialGradient>`,
  ];
  const b = [sectionHeader(t, { eyebrow: "Selected work", title: "Featured projects", aside: `${String(list.length).padStart(2, "0")} projects` })];

  list.forEach((p, i) => {
    const x = 48 + (i % 2) * (cw + gap);
    const y = top + Math.floor(i / 2) * (ch + gap);
    const clip = `${id}-c${i}`;
    const r = 24;
    defs.push(`<clipPath id="${clip}"><path d="M${x} ${y + coverH} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + cw - r} Q${x + cw} ${y} ${x + cw} ${y + r} V${y + coverH} Z"/></clipPath>`);

    b.push(rect(x, y, cw, ch, { fill: t.surface, rx: r }));
    b.push(`<g clip-path="url(#${clip})">`);
    if (covers[p.id]) {
      b.push(`<image x="${x}" y="${y}" width="${cw}" height="${coverH}" preserveAspectRatio="xMidYMid slice" href="${covers[p.id]}"/>`);
    } else {
      b.push(typographicCover(t, theme, p, x, y, cw, coverH, `${id}-warm`));
    }
    b.push(`</g>`);
    b.push(line(x, y + coverH, x + cw, y + coverH, t.border));
    b.push(rect(x + 0.5, y + 0.5, cw - 1, ch - 1, { stroke: t.border, rx: r }));

    // status chip on cover
    const live = p.visibility === "public" && p.demoUrl;
    const chip = live ? "Live demo" : p.visibility === "public" ? "Public repo" : "Private · client work";
    b.push(pill(x + 18, y + 18, chip, { fill: "#FFFFFF", stroke: "#E4E4E7", color: "#18181B", size: 11, padX: 11, h: 26, dot: live ? t.accent : "#A1A1AA" }).svg);

    // body
    const by = y + coverH;
    b.push(text(x + 28, by + 36, p.category.toUpperCase(), { size: 11, weight: 500, fill: t.label, family: MONO, spacing: 1.4 }));
    b.push(text(x + cw - 28, by + 36, p.index, { size: 11, weight: 500, fill: t.faint, family: MONO, anchor: "end", spacing: 1.4 }));
    b.push(
      `<text x="${x + 27}" y="${by + 70}" font-family="${esc(SANS)}" font-size="22" font-weight="600" letter-spacing="-0.6" fill="${t.text}">${esc(p.name)}<tspan font-weight="400" fill="${t.label}"> — ${esc(p.subtitle)}</tspan></text>`,
    );
    wrap(p.description, 68, 2).forEach((l, j) => b.push(text(x + 28, by + 100 + j * 22, l, { size: 14, fill: t.body })));
    b.push(pillRow(x + 28, by + 146, p.highlights, cw - 56, { fill: t.pill, stroke: t.border, color: t.body, size: 12, padX: 12, h: 28 }));
  });

  return doc({
    width: W, height: H, id, theme, defs: defs.join(""),
    title: "Featured projects",
    desc: list.map((p) => `${p.index} ${p.name} — ${p.subtitle}: ${p.description}`).join(" "),
    body: b.join("\n"),
  });
}

await mkdir(OUT, { recursive: true });
const entries = [];
for (const theme of ["dark", "light"]) {
  entries.push({ path: path.join(OUT, `hero-${theme}.svg`), content: hero(theme) });
  entries.push({ path: path.join(OUT, `stack-${theme}.svg`), content: stack(theme) });
  entries.push({ path: path.join(OUT, `projects-${theme}.svg`), content: projects(theme) });
}
await writeAllAtomic(entries);
for (const e of entries) console.log(`WROTE ${path.relative(ROOT, e.path)} (${Math.round(Buffer.byteLength(e.content) / 1024)} KB)`);
