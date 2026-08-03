const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const {
    createRuntimeValidator,
    createSchemaValidators,
    readJson
} = require('../scripts/lib/pack-schema-validation');

const root = path.resolve(__dirname, '..');

function loadPreview(search) {
    const storage = new Map([['needle_game_theme', 'clockwork-observatory']]);
    const listeners = new Map();
    const context = vm.createContext({
        console,
        URLSearchParams,
        CONSTANTS: { THEME_STORAGE_KEY: 'needle_game_theme' },
        VISUAL_SKIN_REGISTRY: {
            has(id) {
                return ['clockwork-observatory', 'gilded-jewel-box'].includes(id);
            }
        },
        localStorage: {
            getItem(key) { return storage.get(key) ?? null; },
            setItem(key, value) { storage.set(key, value); },
            removeItem(key) { storage.delete(key); }
        },
        window: {
            location: { search },
            addEventListener(name, callback) { listeners.set(name, callback); }
        }
    });
    const source = fs.readFileSync(
        path.join(root, 'js/app/PreviewOptions.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\nthis.PreviewOptions = PreviewOptions; this.PREVIEW_OPTIONS = PREVIEW_OPTIONS;`,
        context,
        { filename: 'js/app/PreviewOptions.js' }
    );
    return { context, storage, listeners };
}

function createAppContext() {
    const pack = {
        id: 'e2e',
        levels: [
            { id: 1, order: 1, packLevelId: 'e2e-01' },
            { id: 2, order: 2, packLevelId: 'e2e-02' }
        ]
    };
    const chapters = [
        { id: 'chapter-1', order: 1, title: '一' },
        { id: 'chapter-2', order: 2, title: '二' }
    ];
    return {
        activePackId: null,
        catalog: {
            getPack(id) {
                if (id !== 'e2e') throw new Error(`Unknown pack ${id}`);
                return pack;
            },
            getLevel(id, ref) {
                if (id !== 'e2e') throw new Error(`Unknown pack ${id}`);
                const level = pack.levels.find(candidate => (
                    candidate.packLevelId === ref
                    || candidate.order === Number(ref)
                ));
                if (!level) throw new Error(`Unknown level ${ref}`);
                return level;
            },
            listChapters() { return chapters; }
        },
        router: {
            createLevelRoute(route) { return { type: 'level', ...route }; }
        },
        getActivePackId() { return 'e2e'; },
        setActivePackId(id) { this.activePackId = id; }
    };
}

test('query parameters resolve directly to a validated test-level route', () => {
    const { context, storage, listeners } = loadPreview(
        '?pack=e2e&level=2&mode=test&skin=gilded-jewel-box'
    );
    const destination = context.PREVIEW_OPTIONS.resolve(createAppContext());

    assert.equal(context.PREVIEW_OPTIONS.enabled, true);
    assert.equal(storage.get('needle_game_theme'), 'gilded-jewel-box');
    assert.equal(destination.scene, 'GameScene');
    assert.deepEqual(JSON.parse(JSON.stringify(destination.data.route)), {
        type: 'level',
        packId: 'e2e',
        levelId: 'e2e-02',
        mode: 'test'
    });

    listeners.get('pagehide')();
    assert.equal(storage.get('needle_game_theme'), 'clockwork-observatory');
});

test('lab previews preserve chapter and page without requiring a level', () => {
    const { context } = loadPreview('?pack=e2e&lab=1&chapter=chapter-2&page=3');
    const destination = context.PREVIEW_OPTIONS.resolve(createAppContext());
    assert.equal(destination.scene, 'LevelSelectScene');
    assert.deepEqual(JSON.parse(JSON.stringify(destination.data)), {
        packId: 'e2e',
        chapterId: 'chapter-2',
        page: 3
    });
});

test('unknown URL fields cannot load remote manifests or scripts', () => {
    const { context } = loadPreview(
        '?manifest=https://example.com/pack.json&script=evil.js&url=remote'
    );
    assert.equal(context.PREVIEW_OPTIONS.enabled, false);
    assert.equal(
        context.PREVIEW_OPTIONS.resolve(createAppContext()).scene,
        'MenuScene'
    );
});

test('invalid mode, skin and chapter are rejected before scene routing', () => {
    const app = createAppContext();
    const { context } = loadPreview('');

    assert.throws(
        () => new context.PreviewOptions({ packId: 'e2e', levelId: '1', mode: 'admin' }).resolve(app),
        /mode/
    );
    assert.throws(
        () => new context.PreviewOptions({ packId: 'e2e', skinId: 'unknown' }).resolve(app),
        /未知预览皮肤/
    );
    assert.throws(
        () => new context.PreviewOptions({ packId: 'e2e', lab: true, chapterId: 'missing' }).resolve(app),
        /不存在章节/
    );
});

test('preview CLI prints a canonical stable-id URL without starting a server', () => {
    const result = spawnSync(process.execPath, [
        path.join(root, 'scripts/preview-pack.js'),
        '--pack',
        'balanced-v2',
        '--level',
        '10',
        '--mode',
        'test',
        '--skin',
        'gilded-jewel-box',
        '--print-only',
        '--root',
        root
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    const url = new URL(result.stdout.trim().replace(/^Preview URL:\s*/, ''));
    assert.equal(url.hostname, '127.0.0.1');
    assert.equal(url.searchParams.get('pack'), 'balanced-v2');
    assert.equal(url.searchParams.get('level'), 'balanced-v2-10');
    assert.equal(url.searchParams.get('mode'), 'test');
    assert.equal(url.searchParams.get('skin'), 'gilded-jewel-box');
});

test('unregistered starter example passes formal and relational validation', () => {
    const schemas = createSchemaValidators(root);
    const runtime = createRuntimeValidator(root);
    const directory = path.join(root, 'examples/starter-pack');
    const manifest = readJson(path.join(directory, 'manifest.json'));
    const presets = readJson(path.join(directory, 'presets.json'));
    const levels = readJson(path.join(directory, 'levels.json'));

    assert.equal(schemas.manifest(manifest), true);
    assert.equal(schemas.presets(presets), true);
    assert.equal(schemas.levels(levels), true);
    assert.doesNotThrow(() => runtime.validateBundle(
        { id: manifest.id, manifest: 'manifest.json' },
        manifest,
        presets,
        levels
    ));
    assert.equal(
        readJson(path.join(root, 'packs/index.json')).packs
            .some(entry => entry.id === manifest.id),
        false
    );
});

test('BootScene routes through PreviewOptions only after packs load', () => {
    const source = fs.readFileSync(
        path.join(root, 'js/scenes/BootScene.js'),
        'utf8'
    );
    assert.match(source, /await loader\.loadIndex/);
    assert.match(source, /PREVIEW_OPTIONS\.resolve\(APP_CONTEXT\)/);
    assert.match(source, /this\.scene\.start\(destination\.scene, destination\.data\)/);
});
