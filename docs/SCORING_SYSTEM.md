# Scoring System

The scoring layer is deterministic and independent from Phaser. `GameSession` reports placement evidence; `ScoreSession` turns that evidence into points, combo state, elapsed active-play time, and a result breakdown.

## Default rules

| Event | Points | Notes |
| --- | ---: | --- |
| Successful insertion | 100 | Awarded for every inserted needle. |
| Close placement | +60 | The edge clearance to one neighbouring needle or obstacle is at most 12 px. |
| Threaded placement | +180 | Both clockwise and counter-clockwise edge clearances are at most 12 px. The neighbours must be on distinct sides. |
| Precision combo | +15 per prior chained insertion | The first insertion establishes ×1. Each later insertion advances the chain only when it earns a close or threaded precision result before the deadline; a clear insertion restarts at ×1. Capped at +150 per insertion. |
| Completion speed | +0 to +500 | Uses active play time beginning with the first accepted shot. |

The derived par time is `max(10 s, 1.8 s × needle count + 0.35 s × obstacle count)`. A level may override it with `scoring.parTimeMs` without changing engine code.

Speed tiers:

| Completion time | Bonus |
| --- | ---: |
| ≤ 65% of par | 500 |
| ≤ 85% of par | 350 |
| ≤ 100% of par | 200 |
| ≤ 120% of par | 100 |
| > 120% of par | 0 |

## Boundaries

- Collision remains authoritative in `AngularCollisionRules`; scoring never changes whether a shot succeeds.
- Placement evidence includes the nearest clockwise and counter-clockwise blockers and their edge clearance.
- Score-point fields are non-negative integers. Runtime rule resolution rounds direct programmatic overrides to the same integer contract enforced by the pack schema.
- Gameplay simulation, replay timestamps and scoring consume the same unsmoothed active-frame interval. Low frame rates therefore cannot slow the wheel while also reporting a faster score; browser visibility suspension remains outside active-play time.
- The score is intended to be compared within the same level. Different levels may contain different needle counts and authored rhythms.
- Test mode may calculate and display a score, but the persistence layer should not write it to the progression leaderboard.
- Passing `enabled: false` keeps elapsed-time accounting deterministic while awarding zero points.
