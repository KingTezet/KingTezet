// Renders the static profile components (hero, stack, projects) in dark and
// light variants from scripts/profile.config.json.
// Usage: npm run render:static
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES, SANS, MONO, doc, text, line, rect, wrap, clamp } from "./lib/svg.mjs";
import { writeAllAtomic } from "./lib/write.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "svg");
const config = JSON.parse(await readFile(path.join(ROOT, "scripts", "profile.config.json"), "utf8"));

// ---------------------------------------------------------------- hero
function hero(theme) {
  const t = THEMES[theme];
  const p = config.profile;
  const W = 1200, H = 300;
  const b = [];

  // quiet editorial grid in the right field
  const gx = 856, gy = 48, gw = 296, gh = 204;
  b.push(rect(gx, gy, gw, gh, { fill: t.surface, stroke: t.border, rx: 10 }));
  for (let x = gx + 37; x < gx + gw; x += 37) b.push(line(x, gy + 1, x, gy + gh - 1, t.grid));
  for (let y = gy + 34; y < gy + gh; y += 34) b.push(line(gx + 1, y, gx + gw - 1, y, t.grid));
  // architectural marker: frame + diagonal + node
  const mx = gx + 74, my = gy + 34, mw = 148, mh = 136;
  b.push(rect(mx, my, mw, mh, { stroke: t.muted }));
  b.push(`<path d="M${mx} ${my + mh} L${mx + mw} ${my}" stroke="${t.muted}" stroke-width="1" fill="none"/>`);
  b.push(`<path d="M${mx} ${my + mh / 2} H${mx + mw} M${mx + mw / 2} ${my} V${my + mh}" stroke="${t.border}" stroke-width="1" fill="none"/>`);
  b.push(`<circle cx="${mx + mw}" cy="${my}" r="4" fill="${t.accent}"/>`);
  b.push(`<circle cx="${mx}" cy="${my + mh}" r="3" fill="${t.canvas}" stroke="${t.muted}" stroke-width="1"/>`);
  b.push(text(gx + 16, gy + gh - 14, "FIG. 01 — PRODUCT × SYSTEMS", { size: 10, weight: 500, fill: t.muted, family: MONO, spacing: 0.6 }));
  b.push(text(gx + gw - 16, gy + 22, "UI · DATA · INFRA", { size: 10, weight: 500, fill: t.muted, family: MONO, anchor: "end", spacing: 0.6 }));

  // identity
  b.push(text(48, 68, `GITHUB / ${p.githubUser.toUpperCase()}`, { size: 11, weight: 500, fill: t.muted, family: MONO, spacing: 1.2 }));
  b.push(line(48, 84, 800, 84, t.border));
  b.push(text(46, 140, p.name.toUpperCase(), { size: 48, weight: 700, fill: t.text, family: SANS, spacing: -0.5 }));
  b.push(text(48, 176, p.role, { size: 19, weight: 500, fill: t.text, family: SANS }));
  b.push(text(48, 206, p.tagline, { size: 14, weight: 400, fill: t.muted, family: SANS }));
  b.push(line(48, 228, 800, 228, t.border));

  // availability (static, always legible)
  b.push(`<circle cx="53" cy="253" r="8" fill="none" stroke="${t.accent}" stroke-width="1" stroke-opacity="0.45"/>`);
  b.push(`<circle cx="53" cy="253" r="4" fill="${t.accent}"/>`);
  b.push(text(70, 257, p.availability.toUpperCase(), { size: 11, weight: 600, fill: t.text, family: MONO, spacing: 1.2 }));
  b.push(text(800, 257, p.markets.map((m) => m.toUpperCase()).join(" · "), { size: 11, weight: 500, fill: t.muted, family: MONO, anchor: "end", spacing: 1.2 }));

  return doc({
    width: W, height: H, id: `hero-${theme}`, theme,
    title: `${p.name} — ${p.role}`,
    desc: `${p.tagline} ${p.availability}: ${p.markets.join(", ")}.`,
    body: b.join("\n"),
  });
}

// ---------------------------------------------------------------- stack
function stack(theme) {
  const t = THEMES[theme];
  const W = 1200, H = 250;
  const b = [];
  b.push(text(48, 52, "Core Stack", { size: 22, weight: 600, fill: t.text }));
  b.push(text(1152, 52, `${String(config.stack.length).padStart(2, "0")} GROUPS · FRONTEND-LED`, { size: 10, weight: 500, fill: t.muted, family: MONO, anchor: "end", spacing: 1 }));

  const colW = 264, gap = 16, top = 72, h = 152;
  config.stack.forEach((g, i) => {
    const x = 48 + i * (colW + gap);
    b.push(rect(x, top, colW, h, { fill: t.surface, stroke: t.border, rx: 10 }));
    b.push(text(x + 20, top + 30, `${g.index} — ${g.title.toUpperCase()}`, { size: 10, weight: 500, fill: g.primary ? t.text : t.muted, family: MONO, spacing: 1 }));
    if (g.primary) {
      b.push(`<circle cx="${x + colW - 22}" cy="${top + 26}" r="3" fill="${t.accent}"/>`);
    }
    b.push(line(x + 20, top + 44, x + colW - 20, top + 44, t.border));
    g.items.slice(0, 4).forEach((item, j) => {
      b.push(text(x + 20, top + 72 + j * 21, clamp(item, 30), { size: 14, weight: g.primary ? 500 : 400, fill: t.text }));
    });
  });
  return doc({
    width: W, height: H, id: `stack-${theme}`, theme,
    title: "Core technology stack",
    desc: config.stack.map((g) => `${g.title}: ${g.items.join(", ")}`).join(". ") + ".",
    body: b.join("\n"),
  });
}

// ---------------------------------------------------------------- projects
function projects(theme) {
  const t = THEMES[theme];
  const W = 1200, H = 540;
  const m = 32, gap = 16;
  const cw = (W - m * 2 - gap) / 2; // 560
  const ch = (H - m * 2 - gap) / 2; // 230
  const b = [];
  config.projects.filter((p) => p.featured).slice(0, 4).forEach((p, i) => {
    const x = m + (i % 2) * (cw + gap);
    const y = m + Math.floor(i / 2) * (ch + gap);
    const px = x + 28;
    b.push(rect(x, y, cw, ch, { fill: t.surface, stroke: t.border, rx: 12 }));
    b.push(text(px, y + 38, p.index, { size: 11, weight: 500, fill: t.text, family: MONO, spacing: 1 }));
    b.push(text(px + 30, y + 38, clamp(p.category.toUpperCase(), 52), { size: 10, weight: 500, fill: t.muted, family: MONO, spacing: 1 }));
    b.push(text(px, y + 78, p.name, { size: 19, weight: 600, fill: t.text }));
    wrap(p.description, 72, 2).forEach((l, j) => b.push(text(px, y + 106 + j * 20, l, { size: 14, fill: t.muted })));
    b.push(line(px, y + 144, x + cw - 28, y + 144, t.border));
    wrap(p.highlights.join(" / "), 74, 2).forEach((l, j) =>
      b.push(text(px, y + 166 + j * 16, l, { size: 10, weight: 500, fill: t.text, family: MONO, spacing: 0.3 })),
    );
    const isPublic = p.visibility === "public" && p.repositoryUrl;
    const status = isPublic ? (p.demoUrl ? "PUBLIC REPOSITORY · LIVE DEMO" : "PUBLIC REPOSITORY") : "PRIVATE PROJECT";
    if (isPublic) b.push(`<circle cx="${px + 3}" cy="${y + ch - 22}" r="3" fill="${t.accent}"/>`);
    else b.push(`<circle cx="${px + 3}" cy="${y + ch - 22}" r="3" fill="none" stroke="${t.muted}" stroke-width="1"/>`);
    b.push(text(px + 14, y + ch - 18, status, { size: 10, weight: 500, fill: t.muted, family: MONO, spacing: 1 }));
  });
  return doc({
    width: W, height: H, id: `projects-${theme}`, theme,
    title: "Featured projects",
    desc: config.projects.map((p) => `${p.index} ${p.name} — ${p.description}`).join(" "),
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
for (const e of entries) console.log(`WROTE ${path.relative(ROOT, e.path)}`);
