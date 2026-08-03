const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function load(context, relativePath, names) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const bridge = names.map(name => `this.${name} = ${name};`).join('\n');
    vm.runInContext(`${source}\n${bridge}`, context, { filename: relativePath });
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

const legacyContext = vm.createContext({ console, Math, Number, JSON, Object, Array });
load(legacyContext, 'js/data/levels.js', ['LEVEL_LAYOUTS', 'LEVEL_DEFINITIONS']);
load(legacyContext, 'js/data/balancedLevels.js', [
    'BALANCED_LEVEL_DEFINITIONS',
    'LEVEL_PACKS',
    'DEFAULT_LEVEL_PACK_ID'
]);

const runtimeContext = vm.createContext({
    console: { ...console, error() {} },
    Math,
    Number,
    JSON,
    Object,
    Array,
    URL,
    fetch: async () => { throw new Error('unexpected real fetch'); }
});
load(runtimeContext, 'js/packs/PackValidator.js', ['PackValidationError', 'PackValidator']);
load(runtimeContext, 'js/packs/LevelResolver.js', ['LevelResolver']);
load(runtimeContext, 'js/packs/PackRegistry.js', ['PackRegistry', 'LEVEL_PACK_REGISTRY']);
load(runtimeContext, 'js/packs/PackLoader.js', ['PackLoader']);

const index = readJson('packs/index.json');

function resolveFromDisk(packId) {
    const entry = index.packs.find(pack => pack.id === packId);
    const manifest = readJson(`packs/${packId}/manifest.json`);
    const presets = readJson(`packs/${packId}/${manifest.resources.presets}`);
    const levels = readJson(`packs/${packId}/${manifest.resources.levels}`);
    const validator = new runtimeContext.PackValidator();
    validator.validateBundle(entry, manifest, presets, levels);
    return new runtimeContext.LevelResolver().resolvePack(manifest, presets, levels);
}

function comparable(level) {
    return {
        id: level.id,
        chapter: level.chapter,
        name: level.name,
        rule: level.rule,
        needleCount: level.needleCount,
        layout: plain(level.layout),
        rhythm: plain(level.rhythm),
        designIntent: plain(level.designIntent)
    };
}

test('pack index discovers two independent JSON packs', () => {
    const validator = new runtimeContext.PackValidator();
    assert.equal(validator.validateIndex(index), true);
    assert.equal(index.defaultPackId, 'balanced-v2');
    assert.deepEqual(index.packs.map(pack => pack.id), ['balanced-v2', 'legacy']);

    const balanced = resolveFromDisk('balanced-v2');
    const legacy = resolveFromDisk('legacy');
    assert.equal(balanced.levels.length, 50);
    assert.equal(legacy.levels.length, 50);
    assert.equal(new Set([...balanced.levels, ...legacy.levels].map(level => level.packLevelId)).size, 100);
});

test('resolved JSON packs are exactly equivalent to their JS migration sources', () => {
    const balanced = resolveFromDisk('balanced-v2');
    const legacy = resolveFromDisk('legacy');

    assert.deepEqual(
        plain(balanced.levels.map(comparable)),
        plain(Array.from(legacyContext.BALANCED_LEVEL_DEFINITIONS).map(comparable))
    );
    assert.deepEqual(
        plain(legacy.levels.map(comparable)),
        plain(Array.from(legacyContext.LEVEL_DEFINITIONS).map(comparable))
    );
});

test('pack loader resolves relative resources and registers the default pack', async () => {
    const files = new Map();
    const add = relativePath => files.set(
        `/${relativePath}`,
        readJson(relativePath)
    );
    add('packs/index.json');
    index.packs.forEach(entry => {
        add(`packs/${entry.id}/manifest.json`);
        add(`packs/${entry.id}/presets.json`);
        add(`packs/${entry.id}/levels.json`);
    });

    const registry = new runtimeContext.PackRegistry();
    const loader = new runtimeContext.PackLoader({
        registry,
        fetchJson: async url => {
            const pathname = new URL(url).pathname;
            if (!files.has(pathname)) throw new Error(`missing ${pathname}`);
            return plain(files.get(pathname));
        }
    });
    const progress = [];
    const result = await loader.loadIndex(
        'https://needles.local/packs/index.json',
        state => progress.push(plain(state))
    );

    assert.equal(registry.size, 2);
    assert.equal(registry.defaultPackId, 'balanced-v2');
    assert.equal(registry.getDefault().levels[0].name, '起针校准');
    assert.equal(result.errors.length, 0);
    assert.equal(progress.at(-1).completed, 2);
});

test('one invalid pack is isolated while valid packs remain available', async () => {
    const validEntry = index.packs[0];
    const brokenEntry = { id: 'broken-pack', manifest: 'broken/manifest.json' };
    const customIndex = {
        ...index,
        defaultPackId: validEntry.id,
        packs: [validEntry, brokenEntry]
    };
    const manifest = readJson('packs/balanced-v2/manifest.json');
    const presets = readJson('packs/balanced-v2/presets.json');
    const levels = readJson('packs/balanced-v2/levels.json');
    const resources = new Map([
        ['/packs/index.json', customIndex],
        ['/packs/balanced-v2/manifest.json', manifest],
        ['/packs/balanced-v2/presets.json', presets],
        ['/packs/balanced-v2/levels.json', levels],
        ['/packs/broken/manifest.json', {
            schema: 'needles.level-pack/v1',
            id: 'wrong-id',
            resources: { presets: 'presets.json', levels: 'levels.json' }
        }],
        ['/packs/broken/presets.json', presets],
        ['/packs/broken/levels.json', levels]
    ]);

    const registry = new runtimeContext.PackRegistry();
    const loader = new runtimeContext.PackLoader({
        registry,
        fetchJson: async url => plain(resources.get(new URL(url).pathname))
    });
    const result = await loader.loadIndex('https://needles.local/packs/index.json');

    assert.equal(registry.size, 1);
    assert.equal(registry.get('balanced-v2').levels.length, 50);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].packId, 'broken-pack');
});

test('validator rejects dangling layout references before gameplay starts', () => {
    const entry = index.packs[0];
    const manifest = readJson('packs/balanced-v2/manifest.json');
    const presets = readJson('packs/balanced-v2/presets.json');
    const levels = readJson('packs/balanced-v2/levels.json');
    levels.levels[0].layoutRef = 'missing-layout';

    assert.throws(
        () => new runtimeContext.PackValidator().validateBundle(
            entry,
            manifest,
            presets,
            levels
        ),
        error => error.name === 'PackValidationError'
            && error.details.some(detail => detail.includes('layoutRef'))
    );
});

test('browser runtime no longer preloads concrete level catalogs', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /js\/data\/levels\.js/);
    assert.doesNotMatch(html, /js\/data\/balancedLevels\.js/);
    assert.match(html, /js\/packs\/PackValidator\.js/);
    assert.match(html, /js\/packs\/PackLoader\.js/);
});
