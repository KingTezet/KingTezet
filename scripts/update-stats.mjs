// Fetches public GitHub statistics and renders assets/svg/activity-{dark,light}.svg.
// Env: GITHUB_TOKEN (required), GITHUB_REPOSITORY_OWNER (required).
// Exits non-zero on any API or render failure; previous SVGs are kept intact.
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { THEMES, MONO, doc, text, line, rect, clamp } from "./lib/svg.mjs";
import { writeAllAtomic } from "./lib/write.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets", "svg");
const API = "https://api.github.com";
const MAX_ATTEMPTS = 3;

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
if (!token) fail("GITHUB_TOKEN is not set");
if (!owner) fail("GITHUB_REPOSITORY_OWNER is not set");

const config = JSON.parse(await readFile(path.join(ROOT, "scripts", "profile.config.json"), "utf8"));
if (config.profile.githubUser.toLowerCase() !== owner.toLowerCase()) {
  fail(`owner "${owner}" does not match profile.config.json githubUser "${config.profile.githubUser}"`);
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(endpoint) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${endpoint}`, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "profile-stats-updater",
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      lastErr = new Error(`${endpoint}: network error (${err.name})`);
      if (attempt < MAX_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
      continue;
    }
    if (res.ok) return res.json();

    const remaining = res.headers.get("x-ratelimit-remaining");
    const retryAfter = Number(res.headers.get("retry-after"));
    const isRateLimit = res.status === 429 || (res.status === 403 && remaining === "0");
    if (isRateLimit) {
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : reset ? reset * 1000 - Date.now() : 0;
      if (attempt < MAX_ATTEMPTS && waitMs > 0 && waitMs <= 60_000) {
        await sleep(waitMs);
        continue;
      }
      throw new Error(`${endpoint}: rate limited (HTTP ${res.status})`);
    }
    if (res.status >= 500) {
      lastErr = new Error(`${endpoint}: HTTP ${res.status}`);
      if (attempt < MAX_ATTEMPTS) await sleep(Math.min(8000, 1000 * 2 ** (attempt - 1)));
      continue;
    }
    // 4xx (incl. 401/404): permanent, do not retry
    throw new Error(`${endpoint}: HTTP ${res.status}`);
  }
  throw lastErr;
}

// ---------------------------------------------------------------- data
const user = await gh(`/users/${encodeURIComponent(owner)}`).catch((e) => fail(e.message));
if (!user || user.login?.toLowerCase() !== owner.toLowerCase()) fail("user lookup returned unexpected identity");
const events = await gh(`/users/${encodeURIComponent(owner)}/events/public?per_page=100`).catch((e) => fail(e.message));
if (!Array.isArray(events)) fail("events response is not an array");

const latest = events
  .filter((e) => e && typeof e.created_at === "string")
  .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))[0] ?? null;

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateOnly = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" });

const EVENT_LABEL = {
  PushEvent: "Push",
  CreateEvent: "Create",
  PullRequestEvent: "Pull request",
  IssuesEvent: "Issue",
  IssueCommentEvent: "Comment",
  ReleaseEvent: "Release",
  WatchEvent: "Star",
  ForkEvent: "Fork",
  DeleteEvent: "Delete",
  PublicEvent: "Made public",
  PullRequestReviewEvent: "Review",
};

const model = {
  publicRepos: Number.isInteger(user.public_repos) ? user.public_repos : null,
  followers: Number.isInteger(user.followers) ? user.followers : null,
  latestEvent: latest
    ? {
        date: dateOnly.format(new Date(latest.created_at)),
        type: EVENT_LABEL[latest.type] ?? String(latest.type).replace(/Event$/, ""),
        repo: latest.repo?.name ? String(latest.repo.name).replace(new RegExp(`^${owner}/`, "i"), "") : null,
      }
    : null,
  refreshedAt: fmt.format(new Date()),
};

// ---------------------------------------------------------------- render
function activity(theme) {
  const t = THEMES[theme];
  const W = 1200, H = 260;
  const b = [];
  b.push(text(48, 52, "Public Activity", { size: 22, weight: 600, fill: t.text }));
  b.push(text(1152, 52, "SOURCE · GITHUB REST API", { size: 10, weight: 500, fill: t.muted, family: MONO, anchor: "end", spacing: 1 }));

  const cells = [
    { label: "01 — PUBLIC REPOSITORIES", value: model.publicRepos ?? "N/A", sub: "Owned, public" },
    { label: "02 — FOLLOWERS", value: model.followers ?? "N/A", sub: "GitHub followers" },
    model.latestEvent
      ? {
          label: "03 — LATEST PUBLIC EVENT",
          value: model.latestEvent.date,
          sub: clamp(`${model.latestEvent.type}${model.latestEvent.repo ? " · " + model.latestEvent.repo : ""}`, 34),
          small: true,
          dot: true,
        }
      : { label: "03 — LATEST PUBLIC EVENT", value: "NO RECENT PUBLIC ACTIVITY", sub: "Public events feed is empty", tiny: true },
    { label: "04 — LAST REFRESH", value: model.refreshedAt.split(", ")[0], sub: `${model.refreshedAt.split(", ")[1] ?? ""} WIB · Asia/Jakarta`, small: true },
  ];

  const colW = 264, gap = 16, top = 76, h = 132;
  cells.forEach((c, i) => {
    const x = 48 + i * (colW + gap);
    b.push(rect(x, top, colW, h, { fill: t.surface, stroke: t.border, rx: 10 }));
    b.push(text(x + 20, top + 30, c.label, { size: 10, weight: 500, fill: t.muted, family: MONO, spacing: 1 }));
    if (c.dot) b.push(`<circle cx="${x + colW - 22}" cy="${top + 26}" r="3" fill="${t.accent}"/>`);
    const size = c.tiny ? 13 : c.small ? 26 : 40;
    const weight = c.tiny ? 600 : 700;
    b.push(text(x + 20, top + 86, String(c.value), { size, weight, fill: t.text, family: c.tiny ? MONO : undefined, spacing: c.tiny ? 0.8 : -0.5 }));
    b.push(text(x + 20, top + 112, c.sub, { size: 11, weight: 500, fill: t.muted }));
  });
  b.push(line(48, 228, 1152, 228, t.border));
  b.push(
    text(48, 246, "Latest event reflects GitHub’s recent public events window only — not a total of commits or contributions.", {
      size: 10, weight: 500, fill: t.muted, family: MONO, spacing: 0.2,
    }),
  );
  return doc({
    width: W, height: H, id: `activity-${theme}`, theme,
    title: "Public GitHub activity",
    desc:
      `Public repositories: ${model.publicRepos ?? "unavailable"}. Followers: ${model.followers ?? "unavailable"}. ` +
      (model.latestEvent ? `Latest public event: ${model.latestEvent.type} on ${model.latestEvent.date}. ` : "No recent public activity. ") +
      `Refreshed ${model.refreshedAt} WIB.`,
    body: b.join("\n"),
  });
}

try {
  await mkdir(OUT, { recursive: true });
  await writeAllAtomic([
    { path: path.join(OUT, "activity-dark.svg"), content: activity("dark") },
    { path: path.join(OUT, "activity-light.svg"), content: activity("light") },
  ]);
} catch (err) {
  fail(`render failed: ${err.message}`);
}
console.log(
  `UPDATED activity SVGs · repos=${model.publicRepos} followers=${model.followers} ` +
    `latest=${model.latestEvent ? model.latestEvent.date : "none"} refreshed="${model.refreshedAt} WIB"`,
);
