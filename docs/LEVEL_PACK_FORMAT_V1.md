# Level Pack Format v1

`needles.level-pack/v1` separates authored level content from the Phaser application. A pack contains declarative JSON only: no Phaser objects, executable JavaScript, storage access, UI code, or references to globals owned by another pack.

## Directory layout

```text
packs/
  index.json
  <pack-id>/
    manifest.json
    presets.json
    levels.json
```

The browser loads only `packs/index.json` directly. Every remaining path is resolved relative to the file that declares it.

## Pack index

```json
{
  "schema": "needles.pack-index/v1",
  "defaultPackId": "balanced-v2",
  "packs": [
    {
      "id": "balanced-v2",
      "manifest": "balanced-v2/manifest.json"
    }
  ]
}
```

Pack IDs are stable lowercase identifiers. Adding an internal pack requires adding its manifest to this JSON index; no application JavaScript or HTML changes are required.

## Manifest

```json
{
  "schema": "needles.level-pack/v1",
  "id": "balanced-v2",
  "version": "1.0.0",
  "title": "平滑曲线 V2",
  "caption": "非线性密度与节奏耦合",
  "engineCompatibility": "classic-v1",
  "difficultyModel": "nonlinear-v2",
  "chapters": [
    {
      "id": "chapter-1",
      "order": 1,
      "title": "校准与留白"
    }
  ],
  "resources": {
    "presets": "presets.json",
    "levels": "levels.json"
  }
}
```

`engineCompatibility` is intentionally strict in v1. Unsupported engines are rejected before gameplay starts. `difficultyModel` remains a compatibility field during M1; a later milestone moves difficulty analysis behind one application service.

## Presets

```json
{
  "schema": "needles.level-presets/v1",
  "layouts": {
    "Z3A": {
      "obstacleAngles": [337.5, 146.25, 236.25]
    }
  }
}
```

Presets belong to the pack that declares them. A level may not reference a layout from another pack. Angles are expressed in degrees in the range `[0, 360)`.

## Levels

```json
{
  "schema": "needles.level-list/v1",
  "levels": [
    {
      "id": "balanced-v2-10",
      "legacyNumericId": 10,
      "chapterId": "chapter-1",
      "order": 10,
      "title": "漂移转身",
      "instruction": "长去程接短回摆",
      "objective": {
        "insertCount": 12
      },
      "layoutRef": "Z3A",
      "rhythm": {
        "segments": [
          { "durationMs": 2000, "velocity": 0.56 },
          { "durationMs": 1500, "velocity": -0.24 }
        ]
      },
      "presentation": {
        "tier": 1,
        "milestone": true,
        "focus": "direction"
      },
      "tags": ["direction"]
    }
  ]
}
```

### Stable identity

`id` is the persistent content identity. `order` controls display and progression order and may change without changing the ID. `legacyNumericId` exists only to keep the current scenes and visual catalogs compatible during the staged refactor.

### Rhythm segments

A segment must define exactly one of:

- `velocity`
- `fromVelocity` and `toVelocity`

A ramp may specify `easing` as `linear` or `sine`. Existing shot modifiers remain supported under `rhythm.shotModifier`.

## Runtime pipeline

```text
PackLoader
  -> PackValidator
  -> LevelResolver
  -> PackRegistry
  -> LevelManager compatibility adapter
  -> existing Phaser scenes
```

`PackLoader` isolates failures by pack. If one pack is invalid but another is valid, the game starts with the valid pack and records the rejected pack in `PackRegistry.loadErrors`. The boot scene stops only when no valid pack can be loaded.

`LevelResolver` expands pack-local references and returns the current gameplay shape. This compatibility adapter allows M1 to change data loading without changing collision, rhythm, visuals, or level behavior.

## Authoring a new pack

1. Copy the three JSON resource files into a new `packs/<id>/` directory.
2. Give every pack, chapter, and level a stable ID.
3. Keep all layout references inside that pack's `presets.json`.
4. Add the manifest path to `packs/index.json`.
5. Run `node --test tests/*.test.js`.

No change to `index.html`, `LevelManager`, `GameScene`, or a visual theme is required.

## Migration guarantee

The committed legacy and balanced-v2 JSON packs are generated deterministically from the previous JS catalogs. `node scripts/export-level-packs.js --check` fails when the committed JSON no longer matches those migration sources. Runtime tests compare all gameplay fields for all 100 levels.
