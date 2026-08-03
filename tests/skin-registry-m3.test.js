const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load(context, relativePath, names = []) {
    const exports = Array.isArray(names) ? names : [names];
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const bridge = exports.filter(Boolean)
        .map(name => `this.${name} = ${name};`)
        .join('\n');
    vm.runInContext(`${source}\n${bridge}`, context, { filename: relativePath });
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

const storage = new Map();
const context = vm.createContext({
    console,
    Math,
    Number,
    Object,
    JSON,
    Array,
    Map,
    Set,
    localStorage: {
        getItem(key) { return storage.get(key) || null; },
        setItem(key, value) { storage.set(key, value); }
    }
});

load(context, 'js/utils/constants.js', 'CONSTANTS');
load(context, 'js/data/wheelVisuals.js', 'WHEEL_VISUALS');
load(context, 'js/data/jewelVisuals.js', 'JEWEL_VISUALS');
load(context, 'js/skins/SkinRegistry.js', [
    'SkinRegistry',
    'VISUAL_SKIN_REGISTRY'
]);
load(context, 'js/skins/VisualResolver.js', 'VisualResolver');
load(context, 'js/skins/BuiltinSkins.js');
load(context, 'js/packs/LevelResolver.js', 'LevelResolver');
load(context, 'js/managers/ThemeManager.js', 'ThemeManager');

function resolvePack(packId) {
    const manifest = readJson(`packs/${packId}/manifest.json`);
    const presets = readJson(`packs/${packId}/presets.json`);
    const levels = readJson(`packs/${packId}/levels.json`);
    return new context.LevelResolver().resolvePack(manifest, presets, levels);
}

test('built-in skins are independent registry entries, not level catalogs', () => {
    const skins = context.VISUAL_SKIN_REGISTRY.getAll();
    assert.equal(skins.length, 2);
    assert.deepEqual(Array.from(skins, skin => skin.id), [
        'clockwork-observatory',
        'gilded-jewel-box'
    ]);
    skins.forEach(skin => {
        assert.equal(Array.isArray(skin.presets), true);
        assert.equal('catalog' in skin, false);
        assert.ok(skin.familyOrder.length > 0);
        assert.ok(skin.uiThemeId);
        assert.ok(skin.backgroundThemeId);
    });
});

test('all current pack levels resolve to their exact former visual presets', () => {
    const balanced = resolvePack('balanced-v2');
    const legacy = resolvePack('legacy');
    const manager = new context.ThemeManager();

    [balanced, legacy].forEach(pack => {
        pack.levels.forEach((level, index) => {
            const actual = manager.getLevelVisual(level);
            assert.equal(actual, context.WHEEL_VISUALS[index]);
        });
    });

    manager.setActiveTheme('gilded-jewel-box');
    [balanced, legacy].forEach(pack => {
        pack.levels.forEach((level, index) => {
            const actual = manager.getLevelVisual(level);
            assert.equal(actual, context.JEWEL_VISUALS[index]);
        });
    });
});

test('an arbitrary seventy-three-level pack reuses each skin deterministically', () => {
    const resolver = new context.VisualResolver();
    const levels = Array.from({ length: 73 }, (_, index) => ({
        packLevelId: `long-pack-${String(index + 1).padStart(3, '0')}`,
        order: index + 1,
        chapterId: `chapter-${Math.floor(index / 9) + 1}`,
        presentation: {
            tier: Math.floor(index / 15) + 1,
            milestone: (index + 1) % 9 === 0
        },
        tags: index % 2 === 0 ? ['rhythm'] : ['density']
    }));

    context.VISUAL_SKIN_REGISTRY.getAll().forEach(skin => {
        levels.forEach(level => {
            const first = resolver.resolve(skin, level);
            const second = resolver.resolve(skin, { ...level });
            assert.equal(first, second);
            assert.equal(skin.presets.includes(first), true);
            assert.equal(first.theme, skin.id);
        });
    });
});

test('explicit presentation family and variant override generic tier mapping', () => {
    const resolver = new context.VisualResolver();
    const clockwork = context.VISUAL_SKIN_REGISTRY.get('clockwork-observatory');
    const visual = resolver.resolve(clockwork, {
        packLevelId: 'special-finale',
        order: 1,
        presentation: {
            tier: 1,
            family: 'orrery',
            variant: 10,
            milestone: true
        }
    });

    assert.equal(visual.family, 'orrery');
    assert.equal(visual.motifVariant, 10);
    assert.equal(visual.milestone, true);
});

test('stable identity selects a deterministic fallback when order is absent', () => {
    const resolver = new context.VisualResolver();
    const skin = context.VISUAL_SKIN_REGISTRY.get('gilded-jewel-box');
    const level = {
        packLevelId: 'identity-only-level',
        presentation: { family: 'prism-cut' }
    };
    const first = resolver.resolve(skin, level);
    const second = resolver.resolve(skin, { ...level });
    assert.equal(first, second);
    assert.equal(first.family, 'prism-cut');
});

test('runtime no longer indexes a theme catalog by numeric level id', () => {
    const themeManager = fs.readFileSync(
        path.join(root, 'js/managers/ThemeManager.js'),
        'utf8'
    );
    const gameScene = fs.readFileSync(
        path.join(root, 'js/scenes/GameScene.js'),
        'utf8'
    );
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

    assert.doesNotMatch(themeManager, /catalog\s*\[/);
    assert.doesNotMatch(themeManager, /levelId\s*-\s*1/);
    assert.match(themeManager, /resolver\.resolve\(skin, level\)/);
    assert.match(gameScene, /getLevelVisual\(this\.levelConfig\)/);
    assert.match(html, /js\/skins\/SkinRegistry\.js/);
    assert.match(html, /js\/skins\/VisualResolver\.js/);
    assert.match(html, /js\/skins\/BuiltinSkins\.js/);
});
