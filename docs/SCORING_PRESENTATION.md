# Scoring Presentation

The challenge presentation is an optional layer over the deterministic scoring core.

## Player controls

- Scoring challenge is enabled by default.
- The main menu exposes `S · 计分挑战 开/关`.
- Turning it off hides the score, timer, combo HUD, and all scoring feedback. The underlying score session remains deterministic but awards zero points.
- Test mode displays a clearly labelled test score and is not eligible for the progression leaderboard.

## HUD

The centre of the existing game header now shows:

- current score;
- active play time in tenths of a second;
- current precision combo once a close or threaded insertion advances it to two.

Timing starts only when the first shot is accepted, not when the scene loads.

## Feedback vocabulary

- `贴边好针`: one neighbouring edge is within the precision threshold;
- `双侧穿隙`: both sides are within the threshold;
- `三连精准`, `连击升温`, `势不可挡`, `大师连击`: combo milestones;
- `速度奖励`: completion-time bonus after the clean result snapshot is captured.

All feedback respects the reduced-motion preference. Reduced-motion users still receive the informational label without the travelling or expanding animation.

## Scene integration

`ScoringGameScene` and `ScoringMenuScene` extend the existing scenes rather than moving scoring rules into rendering code. `AppRouter.startResult()` accepts an optional generic `getResultContext()` hook, allowing the result screen and the next persistence PR to consume the final score without coupling the router to scoring.
