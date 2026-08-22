# Local Scoreboard

The scoreboard stores per-level personal bests in local browser storage. It deliberately does not rank scores from different levels against each other because authored needle counts, obstacles, and rhythms are not directly comparable.

## Eligibility

A run is stored only when all conditions are true:

- the level is completed;
- the route is normal progression rather than test mode;
- scoring challenge is enabled;
- the score session finishes with `status: completed`.

Failed attempts still show their score breakdown on the result screen, but they do not replace a completed best.

## Same-level ordering

A candidate replaces the current level best by the following stable order:

1. higher score;
2. shorter active play time when scores tie;
3. higher maximum combo when score and time both tie.

## Storage and display

`ScoreStore` persists a versioned `needle_game_scores` document containing:

- one best record per pack and level;
- a bounded list of recent successful runs for future analysis;
- score breakdown, active time, maximum combo, and precision counts.

The main menu button `B · 本机分数表` opens the six most recently refreshed level bests for the active pack. Resetting all progress also resets local scores, while the scoring on/off preference remains unchanged.

The result scene displays base, precision, combo, and speed points separately and marks a newly written best as `NEW BEST · 新纪录`.
