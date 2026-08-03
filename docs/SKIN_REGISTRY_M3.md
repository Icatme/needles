# Visual Skin Registry — M3

M3 separates visual skins from level-pack length and numeric position. A level pack describes gameplay and optional presentation semantics; a skin owns reusable visual presets and resolves one for any level.

## Runtime components

### `SkinRegistry`

Registers immutable skin descriptors:

```js
VISUAL_SKIN_REGISTRY.register({
  id: 'clockwork-observatory',
  name: '机械天文台',
  caption: '刻度与机芯',
  uiThemeId: 'clockwork-observatory',
  backgroundThemeId: 'clockwork-observatory',
  presets: WHEEL_VISUALS,
  familyOrder: [
    'calibration',
    'geartrain',
    'escapement',
    'chronograph',
    'orrery'
  ]
});
```

A skin descriptor is independent of a level catalog. Its `presets` are a reusable visual pool, not an array whose index must equal `levelId - 1`.

`uiThemeId` and `backgroundThemeId` are independent channels. The two current skins map both channels to their existing implementations, so M3 preserves the current menu and background appearance while removing the architectural assumption that object art, UI palette and background must always share one implementation.

### `VisualResolver`

Resolves a preset using the following priority:

1. explicit `presentation.family`;
2. authored `presentation.tier` / chapter tier;
3. semantic focus and tags when no tier is available;
4. chapter identity fallback;
5. the skin's first family.

Within a family, selection uses:

1. explicit `presentation.variant` or `motifVariant`;
2. authored level `order` modulo the available variants;
3. a deterministic hash of stable `packLevelId` when no order exists.

The result is deterministic. The same level identity and skin always resolve to the same visual preset.

## Level presentation fields

M1 pack JSON already supports a `presentation` object. M3 preserves it in the resolved runtime level:

```json
{
  "presentation": {
    "tier": 3,
    "milestone": false,
    "focus": "rhythm",
    "family": "escapement",
    "variant": 6
  }
}
```

Only `tier` and `milestone` are required by the current migration. `family` and `variant` are optional authoring overrides. A new level pack may omit both and still reuse every registered skin.

## Existing visual compatibility

The current Clockwork Observatory and Gilded Jewel Box each retain their original 50 authored presets. For the existing legacy and balanced-v2 packs:

- tier 1–5 selects the same former chapter family;
- order modulo ten selects the same former motif variant;
- milestone flags remain unchanged.

Automated tests require all 100 current pack-level combinations to resolve to the exact same preset objects used before M3.

## Arbitrary-length packs

A skin does not need the same number of presets as a pack has levels. A 7-level, 37-level, 73-level or 100-level pack can use either current skin. Presets cycle within the selected semantic family, while stable IDs make fallback choices reproducible.

## Compatibility API

`ThemeManager` remains as the UI-facing compatibility name, but it no longer owns `VISUAL_THEMES` or indexes a theme catalog. It delegates to `SkinRegistry` and `VisualResolver`.

Legacy numeric calls such as `getLevelVisual(10)` remain supported and clamped to the existing preset range. Runtime gameplay passes the full resolved level object:

```js
this.levelVisual = this.themeManager.getLevelVisual(this.levelConfig);
```

## Adding a skin

1. Create or import a visual preset pool compatible with the current Wheel, Needle and Obstacle render contracts.
2. Register a descriptor in the skin bootstrap.
3. Declare family order and optional semantic focus mappings.
4. Choose existing or new UI/background channel implementations.
5. Run `node --test tests/*.test.js`.

No level pack, progress record, route or gameplay scene needs a matching visual array.
