# Badges and per-run objectives

Badges and objectives add alternate goals without changing the score formula.

## Per-run objectives

Every scored run receives three deterministic objectives. Turning off the scoring
challenge disables objective presentation and badge evaluation together with the
rest of the scoring layer.

1. complete the level;
2. reach a tempo-combo target derived from needle count;
3. complete a focus-aware objective:
   - speed/rhythm/timing levels use an under-par target;
   - dense or obstacle-heavy levels use one threaded placement;
   - other levels use two close placements.

Objective progress is derived from the immutable score snapshot. Completing an objective never adds points and never changes collision behavior.

## Initial badge set

- First clear
- Three close placements in one run
- Two threaded placements in one run
- Five or more needles without a tempo timeout
- A combo covering the entire level
- The highest time-bonus tier
- Precision on at least half of all insertions
- All three run objectives in one attempt

Badges are global local achievements. The best objective count is also retained per level.

## Persistence

The versioned local key is `needle_game_badges`. Unlocking is idempotent: repeating a qualifying run does not create duplicate awards. Resetting all game progress clears badge and objective records together with scores and best-run trajectories.

## UI

The game HUD shows the next unfinished objective. The result panel summarizes completed objectives and new badges. The menu opens the badge collection with the `A` key or its corresponding button.
