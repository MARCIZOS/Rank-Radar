# Rank Radar

A live-match companion for fantasy cricket fans. It explains why your rank moved on every ball, tells you who to cheer for next, catches you up after you look away, and tracks all your teams at once, in English, Hinglish or Hindi.

**Live demo:** https://subtle-meringue-e283eb.netlify.app/

## The fan problem

During a live match, fantasy players watch their rank swing by thousands with no explanation. They can't tell which player to cheer for, they miss overs on the commute, and multi-team players can't track which entries are still alive.

## Features

| Feature | What it answers |
|---|---|
| Why your rank moved | Every wicket, boundary and over explained in plain words |
| Right now | What a four or wicket from each player in play does to your rank |
| Catch me up | A 15-second recap of the last 5 overs and every team's rank change |
| My teams | All 6 entries live, and how many of them the next ball helps |
| Ask Rank Radar | Question buttons plus free-text questions (Claude, when available) |
| Language | The whole page switches between English, Hinglish and Hindi |

## Run it

No build step and no dependencies. Open `index.html` in any browser, or serve the folder:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

To deploy, drag the folder onto https://app.netlify.com/drop, or push it to a GitHub repo and turn on GitHub Pages.

## Files

```
index.html   page structure
styles.css   design tokens and layout (dark "floodlit stadium" theme, responsive down to 400px)
app.js       match engine, rank model, explanations, translations, UI
```

## How it works

The key design choice: **the numbers are computed, and the AI only explains them.** Claude never calculates a rank or a stat, so it can't invent one.

```
Ball-by-ball match  ──►  Fantasy points per player  ──►  Score 2,500 rival teams  ──►  Your rank
     (ENGINE)                  (fantasyPts)                  (RIVAL_SCORES)            (rankFor)
                                                                                           │
                                       Plain-language explanation  ◄───────────────────────┘
                                 (built-in templates, or Claude when available)
```

### 1. Match engine (`ENGINE` section of app.js)
- `simulate(seed)` plays a T20 chase ball by ball with a seeded random generator, so every run is identical and testable. Seed 62 gives a last-over finish.
- Wickets are scripted (`WICKETS`); runs are weighted by batter power and match phase (powerplay, middle, death).
- Each ball stores a frame: score, batters, bowler and every player's fantasy points.
- `fantasyPts()` implements a simplified T20 scoring model (runs, boundary bonuses, milestones, wickets, catches).

### 2. Rival contest (`MODEL` section)
- `makeRivals()` builds 2,500 rival teams from each player's real-world-style selection % and captain %, using weighted sampling.
- Every frame re-scores all 2,500 rivals. Each one stands in for 100 teams, scaling to a 2,50,000-team contest.
- `rankFor()` counts how many rivals are ahead of you: that count × 100 is your rank.

### 3. Why a player moves your rank
A player's points only change your rank relative to the field when **you own him at a different multiplier than the average rival does**:

```
your edge from a player = his points × (your multiplier − average rival multiplier)
```

So your captain (2×) scoring when only 19% of rivals captained him lifts you, but a popular player you don't own scoring pushes rivals past you. `gains()` computes this per player, and every explanation in the feed comes from it.

### 4. "What if" answers
- `boostRank(f, player, points)` re-ranks you as if a player scored extra points, which powers "a four from Rao moves you ▲ 1,000".
- `helps()` repeats that across all 6 teams to get "helps 4/6, hurts 1".
- `scoreAtRank()` finds the points needed to reach the prize zone.

### 5. Explanations and languages
- `buildMoments()`, `localWhy()`, `localRoot()`, `localTeams()` and `localCatch()` turn the numbers into sentences.
- `tx(L, english, hinglish, hindi)` picks the phrase for the chosen language; `STATIC` holds fixed page text.
- These built-in answers always work, with no login and no internet.

### 6. Claude copilot (`COPILOT` section)
- When the page runs inside claude.ai, `claude.use('sample')` gives access to Claude.
- The page sends Claude the computed match state (ranks, points, ownership) and asks it only to explain.
- The language instruction goes last in the prompt, and `fitsLang()` rejects a reply in the wrong language.
- Claude's answer replaces the instant built-in one only if it arrives in the right language; otherwise the built-in answer stays. The page never waits on AI.

## In production
- Replace `simulate()` with a live ball-by-ball feed.
- Replace the 2,500 sampled rivals with real contest ownership data, computed server-side once per ball for all users.
- Push rank updates to clients, and call the AI only for the explanation step, caching answers per contest per ball.

## Built with
HTML, CSS and vanilla JavaScript (no framework). Claude for the in-app copilot, and as my coding partner while building.
