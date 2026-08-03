# Application Services — M2

M2 separates application state from Phaser scenes and from the level-pack loading boundary introduced in M1.

## Services

### `LevelCatalogService`

Owns read-only access to registered packs, chapters and levels. It resolves stable level IDs, performs difficulty validation and caches audits by pack version and level identity.

Scenes do not inspect `PackRegistry` directly.

### `ProgressStore`

Owns all persistent progression state. Progress is stored by stable `packLevelId`, not by the current numeric position of a level.

Version 2 state:

```json
{
  "version": 2,
  "activePackId": "balanced-v2",
  "packs": {
    "balanced-v2": {
      "packVersion": "1.0.0",
      "completedLevelIds": ["balanced-v2-01"],
      "maxUnlockedOrder": 2
    }
  }
}
```

Existing numeric `maxLevel` and per-pack numeric values are migrated when a pack is first accessed. Reordering levels does not change completed identities.

### `AppRouter`

Carries explicit gameplay context between scenes:

```json
{
  "type": "level",
  "packId": "balanced-v2",
  "levelId": "balanced-v2-10",
  "mode": "test"
}
```

`mode` is either `progression` or `test`. Test completion never writes progress. There is no hidden session-storage flag.

### `AppContext`

Composes the catalog, progress store and router. Phaser scenes consume this application façade instead of reconstructing state from browser storage.

## Scene responsibilities

- Menu: request the current resume route.
- Level browser: query packs, manifest chapters and chapter levels; create test routes.
- Game: run the supplied route and report completion.
- Result: retry or advance using the supplied route.

Scenes do not access `localStorage` or `sessionStorage`.

## Generic chapter browser

The level browser no longer derives chapters using `(level - 1) / 10`. It uses chapter IDs declared by the pack manifest. Chapter sizes are arbitrary; more than ten levels are paginated without changing pack data.

## Compatibility adapter

`LevelManager` remains temporarily as a thin adapter for existing menu and game code. It delegates catalog, progress and route behavior to `AppContext`; it contains no persistence implementation. M4 removes gameplay state ownership from Phaser entirely.
