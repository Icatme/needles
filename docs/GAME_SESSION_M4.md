# Pure Game Session — M4

M4 moves gameplay state and collision decisions out of Phaser. The browser still uses Phaser for input, animation and rendering, but the result of a shot is determined by a headless core.

## Core modules

### `AngularCollisionRules`

All needle caps and locked obstacles occupy the same circular ring. The pure collision rule therefore represents each object as:

```js
{
  id: 5,
  wheelAngle: 1.42,
  radius: 15
}
```

For two objects at angles `a` and `b`, the center distance is the ring chord:

```text
2 × ringRadius × sin(circularAngleDifference / 2)
```

A collision occurs when that distance is strictly smaller than the sum of the two radii. Automated tests compare this rule against the previous world-coordinate circle calculation over the complete ring for needle/needle and needle/obstacle radii.

The rule owns no Phaser objects and does not read entity positions.

### `GameSession`

`GameSession` receives one resolved level configuration and owns:

- rhythm integration;
- authoritative wheel rotation;
- fixed obstacle models;
- inserted needle models;
- descending needle numbers;
- shot acceptance;
- impact-angle conversion;
- collision outcomes;
- successful-insert rhythm modifiers;
- failure and completion state;
- ordered domain events.

State progression:

```text
ready
  -> in-flight
      -> failed
      -> completed
      -> locked
          -> ready
```

`locked` corresponds to the existing post-insertion UI delay. The duration remains an application/view setting (`CONSTANTS.DIFFICULTY.INSERT_LOCK_MS`, currently 200 ms); the pure core only requires an explicit `releaseShotLock()` command.

## Frame output versus transition snapshots

`advance(deltaMs)` is called every render frame. It returns a lightweight immutable frame:

```js
{
  rotationDelta,
  wheelRotation,
  status,
  rhythm
}
```

It does not clone all needles and obstacles. Full immutable snapshots are produced only when the application explicitly requests one or when a shot/state transition returns an outcome.

This avoids per-frame array allocation while keeping transition results safe to inspect, record or replay.

## Domain events

The session emits ordered events:

- `shot-started`
- `needle-inserted`
- `shot-ready`
- `collision`
- `level-completed`

Events contain plain data and a monotonically increasing sequence number. `drainEvents()` allows later telemetry, replay or simulation tools to consume them without coupling the core to analytics or UI.

## Phaser adapter

`GameScene` is now an adapter. It is responsible for:

- creating Wheel, Needle and Obstacle display objects;
- translating pointer/keyboard input into `beginShot()`;
- playing the needle flight animation;
- calling `resolveImpact()` when the animation reaches the wheel;
- attaching the visual needle at the angle returned by the session;
- rotating display objects by the session frame delta;
- displaying particles, catchlights and result panels;
- releasing the 200 ms visual lock.

It does not instantiate `RhythmManager` or `CollisionManager`, calculate collision angles, or record successful inserts.

## Runtime loading

The browser loads:

```text
RhythmManager
AngularCollisionRules
GameSession
GameScene
```

The former `CollisionManager.js` remains in the repository as migration history and for older geometry regression fixtures, but it is not loaded by `index.html` and does not participate in runtime gameplay.

## Headless use

A session can be created in Node or another JavaScript runtime without Phaser:

```js
const session = new GameSession(level);
session.advance(500);
session.beginShot();
const result = session.resolveImpact();
```

This boundary enables future work without another gameplay rewrite:

- automated level simulations;
- deterministic replays from commands and frame deltas;
- telemetry reconstruction;
- difficulty-model calibration from synthetic agents;
- alternate renderers or clients.

## Preserved contracts

M4 does not change:

- the 172 px cap ring;
- 15 px needle radius;
- 17 px obstacle radius;
- six-o'clock impact angle;
- exact RhythmManager integration;
- shot modifiers occurring only after a successful insertion;
- descending labels;
- needle flight speed;
- insertion depth;
- the 200 ms post-insertion view lock;
- visual themes, level packs or persistent progress.
