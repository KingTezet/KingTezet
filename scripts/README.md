# Profile maintenance

| File | Purpose |
|---|---|
| `profile.config.json` | Single source of truth: identity, availability, stack groups, featured projects, verified links. Leave a URL `null` unless verified. |
| `render-static.mjs` | Renders `hero`, `stack`, `projects` SVGs (dark + light) from the config. Run after editing the config: `npm run render:static`. |
| `update-stats.mjs` | Fetches `GET /users/{owner}` and `GET /users/{owner}/events/public` and renders `activity-{dark,light}.svg`. Needs `GITHUB_TOKEN` and `GITHUB_REPOSITORY_OWNER`. |
| `validate-svg.py` | Parses every SVG with `xml.etree.ElementTree`, checks dimensions, dark/light pairs, forbidden content, and README local asset paths. |
| `lib/svg.mjs`, `lib/write.mjs` | Design tokens, XML escaping, text helpers; atomic group writes. |

## Local run

```bash
npm run render:static
GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY_OWNER=KingTezet npm run update:stats
npm run validate
```

No npm dependencies — Node 22 built-ins (`fetch`, `Intl`, `fs/promises`) and Python stdlib only.

## Automation notes

- Workflow `.github/workflows/update-stats.yml` runs daily at `17:17 UTC` (`00:17 WIB`) and on `workflow_dispatch`.
- GitHub may delay scheduled runs under load. Scheduled workflows in public repos are disabled after 60 days without repository activity; the daily commit normally keeps the repo active, but re-enable with `gh workflow enable update-stats.yml` if needed.
- Commits only `activity-*.svg`, only when they change, only after validation passes. Not triggered on `push`, so no loop.
- Actions are pinned to commit SHAs: `actions/checkout` v7.0.1, `actions/setup-node` v7.1.0.

## Metric semantics

- *Latest public event* comes from GitHub's recent public events window (max ~90 days / 300 events). It is not a total of commits or contributions, and private activity is never included.
- Missing values render as `N/A` / `NO RECENT PUBLIC ACTIVITY`, never `0`.
- Static availability marker only — no CSS/SMIL animation (GitHub image proxy rendering is not guaranteed).
