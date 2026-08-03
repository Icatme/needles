const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function loadIntoContext(context, relativePath, exportName) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    vm.runInContext(`${source}\nthis.${exportName} = ${exportName};`, context, {
        filename: relativePath
    });
}

const storage = new Map();
const context = vm.createContext({
    console,
    Math,
    Number,
    localStorage: {
        getItem(key) { return storage.get(key) || null; },
        setItem(key, value) { storage.set(key, value); }
    }
});

loadIntoContext(context, 'js/utils/constants.js', 'CONSTANTS');
loadIntoContext(context, 'js/data/wheelVisuals.js', 'WHEEL_VISUALS');
loadIntoContext(context, 'js/data/jewelVisuals.js', 'JEWEL_VISUALS');
loadIntoContext(context, 'js/managers/ThemeManager.js', 'ThemeManager');

test('theme manager defaults to clockwork and exposes two complete catalogs', () => {
    storage.clear();
    const manager = new context.ThemeManager();
    const themes = Array.from(manager.getThemes());

    assert.equal(manager.getActiveTheme().id, 'clockwork-observatory');
    assert.deepEqual(themes.map(theme => theme.id), [
        'clockwork-observatory',
        'gilded-jewel-box'
    ]);
    themes.forEach(theme => assert.equal(theme.catalog.length, 50));
});

test('selected theme persists and resolves the matching level visual', () => {
    storage.clear();
    const manager = new context.ThemeManager();

    assert.equal(manager.setActiveTheme('gilded-jewel-box'), true);
    assert.equal(storage.get(context.CONSTANTS.THEME_STORAGE_KEY), 'gilded-jewel-box');
    assert.equal(manager.getLevelVisual(1).theme, 'gilded-jewel-box');
    assert.equal(manager.getLevelVisual(50).id, 50);

    const reloaded = new context.ThemeManager();
    assert.equal(reloaded.getActiveTheme().id, 'gilded-jewel-box');
    assert.equal(reloaded.getLevelVisual(999).id, 50);
});

test('unknown themes are rejected without replacing the active selection', () => {
    storage.clear();
    const manager = new context.ThemeManager();

    assert.equal(manager.setActiveTheme('not-a-theme'), false);
    assert.equal(manager.getActiveTheme().id, 'clockwork-observatory');
    assert.equal(storage.has(context.CONSTANTS.THEME_STORAGE_KEY), false);
});
