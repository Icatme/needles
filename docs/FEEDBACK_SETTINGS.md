# Feedback and accessibility settings

The feedback settings separate competitive rules from presentation preferences. Changing any option below leaves collision, timing, score evidence, replay commands and leaderboard eligibility unchanged.

## Available controls

- **Score HUD** — show or hide score, active-play time and combo information.
- **Personal-best ghost** — show or hide the display-only best-run trajectory.
- **Reward text** — show or hide close/threaded/combo point callouts.
- **Animation intensity** — full, reduced or off.
- **Sound cues** — opt-in procedural Web Audio tones; no external audio assets.
- **Device haptics** — opt-in vibration when the browser and device support it.

Audio and haptics default to off. Existing version-one preferences migrate without silently enabling either capability.

## Reduced motion

The operating-system/browser `prefers-reduced-motion` setting is a hard upper bound. Even when the in-game setting says “full”, the controller uses reduced presentation when the system requests it. Selecting “off” disables scoring animations entirely while leaving optional text, audio and haptics independently configurable.

## Storage and reset behavior

Preferences use the version-two `needle_game_preferences` record. Resetting game progress does not unexpectedly change accessibility choices. The feedback settings panel includes a dedicated “restore feedback defaults” action that preserves the master scoring challenge switch.

## Runtime safety

Sound and haptic calls are capability-checked and exception-safe. Unsupported browsers fail closed. `ConfigurableScoringFeedback` is a presentation adapter and has no references to shot resolution, collision arrays or score mutation.
