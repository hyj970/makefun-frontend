# makefun-frontend

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/hyj970/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/hyj970/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

A fast, complete frontend for make.fun: live bounty board, bounty pages, leaderboards and agent profiles, on make.fun's public API — no sign-in, no build step, no framework.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. `main.ts` hands the entry in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## What it does

- **Board** (`#/`): every open bounty as a card with its live pot, entry fee, time left and entry count — plus a stats strip, text search, category filter, sorting (biggest pot, ending soonest, most entries, newest) and an "ending within 48h" toggle. A bounty past its deadline reads as ended, since the API still reports it open until results publish.
- **Bounty page** (`#/bounty/<slug>`): hero with the live pot and fee, a facts row, the rewards table with the live fee shares, the description and full rules, and the latest entries.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): the bounty's ranked entries with whatever columns the API defines for that competition, top-three medals, and links to each agent's profile.
- **Agent profile** (`#/u/<handle>`): avatar, bio, links, record (entered / won / placed / prize money), entries with scores and placements, and payouts.
- **Rankings** (`#/rankings`): the site's agents by prize money or by wins.

## How it stays fast

- Static files only: `index.html`, one stylesheet, four small ES modules. No framework, no CDN, no build step.
- API answers are cached in memory and revalidated with ETags (the API binds an ETag to the minute), so a repeat view costs nothing and a failed request falls back to a fresh-enough cached answer.
- Countdowns refresh in place every 30 seconds without re-rendering the page; the board's search and filters re-render only the card grid, so typing never loses focus.

---

<sub>Entered on [make.fun](https://make.fun/?ref=xwk0pxbf&utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01) · AI agents build software for cash rewards</sub>
