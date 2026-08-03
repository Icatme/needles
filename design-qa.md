# Gilded Jewel Box shine v2 — design QA

## Comparison target

- User-visible flat baseline: `C:\Users\icatm\AppData\Local\Temp\codex-clipboard-c98caf3f-aae5-4159-9a5d-9dba5c032afe.png`
- ChatGPT ImageGen production sources: `assets/jewel-shine/wheel-specular-bold-source.png` and `assets/jewel-shine/gem-catchlight-bold-source.png`
- Final-size texture check: `output/imagegen/jewel-shine-bold-final-size-preview.png`
- Browser-rendered implementation: `output/playwright/jewel-chatgpt-bold-shine-level-01.jpg`
- Before/after evidence: `output/playwright/jewel-shine-v2-before-after.png`
- Hard-shadow cleanup: `output/playwright/jewel-shadow-removed-level-01.jpg`
- Browser state: jewelry theme, level 1, needle 5 inserted, needle 4 ready, four needles remaining.

## Root cause and correction

- The first 512 px assets relied on hairline highlights and tiny sparkles. At the real 176 px wheel and 21–30 px gem-cap sizes, those details collapsed to roughly one or two pixels, so the result still read as flat vector art.
- ChatGPT ImageGen regenerated both textures specifically for their final display sizes. The wheel now uses broad upper-left and lower-right reflection bands with large hot cores; the cap texture uses chunky facets, a bold star catchlight, and a dark central numeral window.
- Near-black source pixels were clamped to pure black before `SCREEN` blending. This preserves only emitted light and prevents a dark square or gray haze around either overlay.
- The game now loads the bold 512 px textures; no wheel geometry, collision geometry, level data, rhythm, or needle trajectory changed.

## Findings

- The wheel reads as polished plum enamel with a rose-gold rim. Its broad highlight survives downsampling and remains clearly visible against the warm paper background.
- Ready and attached gem caps both retain visible facets and specular contrast at gameplay size; the center remains open enough for upright numerals.
- The overlay does not introduce black-box edges or transparency halos. Level-specific motifs remain legible beneath the light treatment.
- The shine is produced by ChatGPT ImageGen raster assets, not newly hand-drawn vector highlights. Phaser only positions, blends, and modulates those assets.
- The inserted cap remains outside the collision rim while the needle tip is concealed inside the wheel, and the successful shot has no scale or position recoil.
- The former wheel “shadow” was a sharp 93 px ink disc shifted 5 px below the 88 px wheel. It produced a visible gray crescent rather than a believable soft shadow, so the jewelry theme now omits it entirely and relies on its rose-gold rim and generated specular texture for depth.

## Interaction and runtime checks

- Chrome rendered the jewelry theme, accepted a shot, changed the remaining count from 5 to 4, and showed both the attached and next-ready gem treatments.
- Browser developer logs contain no game errors. The only warning belongs to the Codex Chrome extension's unconfigured optional agent and is unrelated to the game.
- `node --check js/scenes/BootScene.js` passes.
- `node --test tests/*.test.js` passes all 35 tests, including a regression check that the jewelry wheel emits no oversized offset shadow circle.

final result: passed

## Gem catchlight v3 — stronger final-size brilliance

- ChatGPT ImageGen edited the prior catchlight into `assets/jewel-shine/gem-catchlight-luminous-source.png`; the optimized runtime texture is `assets/jewel-shine/gem-catchlight-luminous-512.png`.
- The new texture replaces thin lines with broad white facets, two large reflection masses, a compact hot sparkle, and restrained spectral edge color. The central numeral window remains dark and unobstructed.
- At a 24 px simulation, mean emitted-light intensity rises from 40.1 to 57.2; pixels at or above 160 rise from 63 to 96, and hot pixels at or above 230 rise from 29 to 56.
- Runtime alpha now spans 0.64–0.98 for inserted gems and 0.98 for the ready gem, while retaining fixed-light angle modulation and the position/scale-free insertion flash.
- Real-browser evidence: `output/playwright/jewel-luminous-level-01.png` and `output/playwright/jewel-luminous-inserted-level-01.png`. The latter shows an attached gem and the next ready gem with readable numbers and no game console errors.

final result: passed
