# Daily challenges and verified score replays

## Deterministic challenge selection

The daily challenge is selected locally from:

- the UTC calendar date;
- pack id;
- pack version;
- the pack's resolved level list.

The same build therefore selects the same level for every player on the same UTC date. A pack-version change intentionally creates a different seed domain.

Daily runs use a dedicated `daily` route mode. The game records an in-memory replay for verification, but does not write a playtest attempt, campaign progress, personal score or best-run ghost. A completed daily challenge can only be retried or left for the menu; it cannot continue into another level under the daily route.

## Independent verification

A daily result is stored only after `ScoreReplayVerifier` performs all of the following:

1. validates the replay schema, engine version, commands, duration, final summary and digest;
2. compares the replay level descriptor with the resolved level;
3. creates a fresh `GameSession` and replays every timestamped command;
4. compares each replayed command outcome with the recorder's expected outcome;
5. creates a fresh `ScoreSession` and recomputes timing, placement, combo, precision and completion bonuses;
6. requires both the replay and recomputed gameplay to end in the completed state;
7. compares the recomputed final gameplay summary with the replay's final summary;
8. compares the canonical recomputed score summary with the claimed result;
9. emits a verification digest over replay digest, scoring profile id and score summary.

The verifier does not trust canvas state, HUD text, local score storage or the submitted total.

## Local daily records

`DailyChallengeStore` retains one best verified record per challenge id and a bounded recent history. Tie-breaking is:

1. higher score;
2. shorter active-play time;
3. higher maximum combo.

The local key is `needle_game_daily_challenges`.

## Security scope

The verification digest is deterministic and tamper-evident; it is not a server signature. A future network leaderboard should accept the replay and challenge identity, rerun the same verifier in a trusted service, and store only server-verified results. The current static build deliberately does not claim that local browser storage is an online anti-cheat authority.
