# Daily challenges and verified score replays

## Deterministic challenge selection

The daily challenge is selected locally from:

- the UTC calendar date;
- pack id;
- pack version;
- the pack's resolved level list.

The same build therefore selects the same level for every player on the same UTC date. A pack-version change intentionally creates a different seed domain and a different challenge id. The challenge identity binds date, pack id, pack version, level id/order/name, numeric seed and seed digest.

Daily runs use a dedicated `daily` route mode. The game records an in-memory replay for verification, but does not write a playtest attempt, campaign progress, personal score or best-run ghost. A completed daily challenge can only be retried or left for the menu; it cannot continue into another level under the daily route.

## Independent verification

A daily result is stored only after `ScoreReplayVerifier` performs all of the following:

1. validates the replay schema, engine version, commands, duration, final summary and digest;
2. compares the replay level descriptor with the resolved level;
3. rejects replay geometry that differs from the engine contract, then creates a fresh `GameSession` with canonical geometry and replays every timestamped command;
4. compares each replayed command outcome with the recorder's expected outcome;
5. creates a fresh `ScoreSession` and recomputes timing, placement, combo, precision and completion bonuses;
6. requires both the replay and recomputed gameplay to end in the completed state;
7. compares the recomputed final gameplay summary with the replay's final summary;
8. compares the canonical recomputed score summary with the claimed result;
9. emits a verification digest over replay digest, scoring profile id, canonical daily challenge identity and score summary.

The service reconstructs the active challenge from the current catalog and its persisted date, then compares it with the resolved level. Caller-supplied challenge metadata cannot choose the record key or overwrite date/pack/version/level/seed fields. The verifier does not trust canvas state, HUD text, replay geometry, local score storage or the submitted total.

## Local daily records

`DailyChallengeStore` retains one best verified record per versioned challenge id and a bounded recent history. Version-two records persist the full canonical challenge identity and accept only a verification digest bound to that identity. Tie-breaking is:

1. higher score;
2. shorter active-play time;
3. higher maximum combo.

The local key is `needle_game_daily_challenges`.

## Security scope

The verification digest is deterministic and tamper-evident; it is not a server signature. A future network leaderboard should accept the replay and challenge identity, rerun the same verifier in a trusted service, and store only server-verified results. The current static build deliberately does not claim that local browser storage is an online anti-cheat authority.
