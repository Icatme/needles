const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    assertSchema,
    createRuntimeValidator,
    createSchemaValidators,
    readJson,
    validatePackRepository
} = require('../scripts/lib/pack-schema-validation');

const root = path.resolve(__dirname, '..');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function currentBundle(packId = 'balanced-v2') {
    const entry = { id: packId, manifest: `${packId}/manifest.json` };
    const directory = path.join(root, 'packs', packId);
    return {
        entry,
        manifest: readJson(path.join(directory, 'manifest.json')),
        presets: readJson(path.join(directory, 'presets.json')),
        levels: readJson(path.join(directory, 'levels.json'))
    };
}

test('all committed packs pass formal schemas and runtime relationships', () => {
    const result = validatePackRepository(root);
    assert.equal(result.valid, true);
    assert.equal(result.defaultPackId, 'balanced-v2');
    assert.equal(result.packCount, 2);
    assert.equal(result.levelCount, 100);
    assert.deepEqual(
        result.packs.map(pack => [pack.id, pack.levelCount]),
        [['balanced-v2', 50], ['legacy', 50]]
    );
});

test('formal schemas reject the same local shape errors as PackValidator', () => {
    const schemas = createSchemaValidators(root);
    const runtime = createRuntimeValidator(root);
    const index = readJson(path.join(root, 'packs/index.json'));
    const bundle = currentBundle();

    const badIndex = clone(index);
    badIndex.defaultPackId = 'Uppercase';
    assert.equal(schemas.index(badIndex), false);
    assert.throws(() => runtime.validateIndex(badIndex), /Invalid pack index/);

    const badManifest = clone(bundle.manifest);
    delete badManifest.title;
    assert.equal(schemas.manifest(badManifest), false);
    assert.throws(
        () => runtime.validateBundle(
            bundle.entry,
            badManifest,
            bundle.presets,
            bundle.levels
        ),
        /Invalid level pack/
    );

    const badPresets = clone(bundle.presets);
    badPresets.layouts.Z0.obstacleAngles = [360];
    assert.equal(schemas.presets(badPresets), false);
    assert.throws(
        () => runtime.validateBundle(
            bundle.entry,
            bundle.manifest,
            badPresets,
            bundle.levels
        ),
        /Invalid level pack/
    );

    const badLevels = clone(bundle.levels);
    badLevels.levels[0].rhythm.segments[0].fromVelocity = 0;
    badLevels.levels[0].rhythm.segments[0].toVelocity = 1;
    assert.equal(schemas.levels(badLevels), false);
    assert.throws(
        () => runtime.validateBundle(
            bundle.entry,
            bundle.manifest,
            bundle.presets,
            badLevels
        ),
        /Invalid level pack/
    );
});

test('JSON Schema handles file shape while runtime validator handles references', () => {
    const schemas = createSchemaValidators(root);
    const runtime = createRuntimeValidator(root);
    const bundle = currentBundle();
    const dangling = clone(bundle.levels);
    dangling.levels[0].layoutRef = 'missing-layout';

    assert.equal(schemas.levels(dangling), true);
    assert.throws(
        () => runtime.validateBundle(
            bundle.entry,
            bundle.manifest,
            bundle.presets,
            dangling
        ),
        /layoutRef is unknown/
    );
});

test('schemas are strict about unknown authoring fields', () => {
    const schemas = createSchemaValidators(root);
    const bundle = currentBundle();

    const extraManifest = clone(bundle.manifest);
    extraManifest.executable = 'plugin.js';
    assert.equal(schemas.manifest(extraManifest), false);

    const extraLevel = clone(bundle.levels);
    extraLevel.levels[0].script = 'arbitrary-code';
    assert.equal(schemas.levels(extraLevel), false);

    assert.throws(
        () => assertSchema(schemas.levels, extraLevel, 'levels.json'),
        /additional properties/
    );
});

test('VS Code maps every pack authoring file to its schema', () => {
    const settings = readJson(path.join(root, '.vscode/settings.json'));
    const matches = settings['json.schemas'].flatMap(entry => entry.fileMatch);
    [
        '/packs/index.json',
        '/packs/*/manifest.json',
        '/packs/*/presets.json',
        '/packs/*/levels.json'
    ].forEach(expected => {
        assert.equal(matches.includes(expected), true, `${expected} must be mapped`);
    });
    settings['json.schemas'].forEach(entry => {
        assert.equal(
            fs.existsSync(path.resolve(root, entry.url)),
            true,
            `${entry.url} must exist`
        );
    });
});

test('validate:packs CLI prints a machine-readable summary', () => {
    const result = spawnSync(
        process.execPath,
        [path.join(root, 'scripts/validate-packs.js'), root],
        { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.valid, true);
    assert.equal(summary.packCount, 2);
    assert.equal(summary.levelCount, 100);
});
