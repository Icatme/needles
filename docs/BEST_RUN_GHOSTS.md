# Personal-best splits and ghost runs

This layer supplements the per-level score table with the timing evidence needed for useful rematches. It does not participate in collision or scoring decisions.

## Stored evidence

When `ScoreStore` accepts a completed run as the new personal best, `BestRunStore` saves a bounded trajectory containing, for every successful insertion:

- zero-based insertion index;
- active-play timestamp;
- wheel-local angle;
- precision classification.

The score table remains authoritative for deciding whether a run is a personal best. A trajectory is never allowed to promote a score by itself.

## Split comparison

During a later attempt, each successful insertion is compared with the matching insertion in the saved best run. The HUD reports a signed delta:

- negative means the current run is ahead;
- positive means it is behind;
- the completion delta compares active-play duration, not scene or result-screen time.

## Ghost rendering

The ghost reveals saved needles only when their original active-play timestamps are reached. Saved wheel-local angles are transformed through the current wheel rotation on every frame.

Ghost needles are drawn by an isolated graphics object. They are never inserted into `GameSession`, `insertedNeedles`, obstacle arrays, collision rules, replays, or score evidence. Disabling ghost display therefore changes presentation only.

## Storage lifecycle

The local key is `needle_game_best_runs`. Each trajectory carries the same immutable scoring contract identifier as its score record. A pack or scoring-rule revision therefore cannot reuse a stale trajectory. Resetting all progress clears score records and best-run trajectories together. Older score records without trajectory evidence continue to work; the ghost appears after the next personal best is recorded.
