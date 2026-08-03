const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function loadIntoContext(context, relativePath, exportNames = []) {
    const names = Array.isArray(exportNames) ? exportNames : [exportNames];
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    const bridge = names.filter(Boolean)
        .map(name => `this.${name} = ${name};`)
        .join('\n');
    vm.runInContext(`${source}\n${bridge}`, context, {
        filename: relativePath
    });
}

const storage = new Map();
const context = vm.createContext({
    console,
    Math,
    Number,
    Object,
    JSON,
    Map,
    Set,
    localStorage: {
        getItem(key) { return storage.get(key) || null; },
        setItem(key, value) { storage.set(key, value); }
    }
});

loadIntoContext(context, 'js/utils/constants.js', 'CONSTANTS');
loadIntoContext(context, 'js/data/wheelVisuals.js', 'WHEEL_VISUALS');
loadIntoContext(context, 'js/data/jewelVisuals.js', 'JEWEL_VISUALS');
loadIntoContext(context, 'js/skins/SkinRegistry.js', [
    'SkinRegistry',
    'VISUAL_SKIN_REGISTRY'
]);
loadIntoContext(context, 'js/skins/VisualResolver.js', 'VisualResolver');
loadIntoContext(context, 'js/skins/BuiltinSkins.js');
loadIntoContext(context, 'js/managers/ThemeManager.js', 'ThemeManager');

test('theme manager defaults to clockwork and exposes skin summaries', () => {
    storage.clear();
    const manager = new context.ThemeManager();
    const themes = Array.from(manager.getThemes());

    assert.equal(manager.getActiveTheme().id, 'clockwork-observatory');
    assert.deepEqual(themes.map(theme => theme.id), [
        'clockwork-observatory',
        'gilded-jewel-box'
    ]);
    themes.forEach(theme => {
        assert.equal('catalog' in theme, false);
        assert.equal('presets' in theme, false);
    });
    assert.equal(manager.getActiveTheme().presets.length, 50);
});

test('selected skin persists and resolves matching level semantics', () => {
    storage.clear();
    const manager = new context.ThemeManager();

    assert.equal(manager.setActiveTheme('gilded-jewel-box'), true);
    assert.equal(storage.get(context.CONSTANTS.THEME_STORAGE_KEY), 'gilded-jewel-box');
    assert.equal(manager.getLevelVisual({
        order: 1,
        packLevelId: 'custom-01',
        presentation: { tier: 1 }
    }).theme, 'gilded-jewel-box');
    assert.equal(manager.getLevelVisual(50).id, 50);

    const reloaded = new context.ThemeManager();
    assert.equal(reloaded.getActiveTheme().id, 'gilded-jewel-box');
    assert.equal(reloaded.getLevelVisual(999).id, 50);
});

test('skin exposes independent UI and background channels', () => {
    storage.clear();
    const manager = new context.ThemeManager();
    assert.equal(manager.getUIThemeId(), 'clockwork-observatory');
    assert.equal(manager.getBackgroundThemeId(), 'clockwork-observatory');

    manager.setActiveTheme('gilded-jewel-box');
    assert.equal(manager.getUIThemeId(), 'gilded-jewel-box');
    assert.equal(manager.getBackgroundThemeId(), 'gilded-jewel-box');
});

test('unknown skins are rejected without replacing the active selection', () => {
    storage.clear();
    const manager = new context.ThemeManager();

    assert.equal(manager.setActiveTheme('not-a-theme'), false);
    assert.equal(manager.getActiveTheme().id, 'clockwork-observatory');
    assert.equal(storage.has(context.CONSTANTS.THEME_STORAGE_KEY), false);
});
