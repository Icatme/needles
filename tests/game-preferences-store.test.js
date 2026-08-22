const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadStore() {
    const context = vm.createContext({ console, JSON, Object, Boolean });
    const source = fs.readFileSync(
        path.join(root, 'js/app/GamePreferencesStore.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\nthis.GamePreferencesStore = GamePreferencesStore;`,
        context,
        { filename: 'js/app/GamePreferencesStore.js' }
    );
    return context.GamePreferencesStore;
}

function createStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        snapshot() {
            return Object.fromEntries(data);
        }
    };
}

test('scoring challenge is enabled by default', () => {
    const Store = loadStore();
    const store = new Store({ storage: null });

    assert.equal(store.isScoringEnabled(), true);
    assert.deepEqual(JSON.parse(JSON.stringify(store.snapshot())), {
        version: 1,
        scoringEnabled: true
    });
});

test('toggle persists and is restored by a new store', () => {
    const Store = loadStore();
    const storage = createStorage();
    const first = new Store({ storage });

    assert.equal(first.toggleScoring(), false);
    const second = new Store({ storage });
    assert.equal(second.isScoringEnabled(), false);
    assert.match(
        storage.snapshot().needle_game_preferences,
        /"scoringEnabled":false/
    );
});

test('unknown or malformed preference fields fall back safely', () => {
    const Store = loadStore();
    const storage = createStorage({
        needle_game_preferences: JSON.stringify({
            version: 99,
            scoringEnabled: 'yes',
            unrelated: true
        })
    });
    const store = new Store({ storage });

    assert.equal(store.isScoringEnabled(), true);
    assert.deepEqual(JSON.parse(JSON.stringify(store.snapshot())), {
        version: 1,
        scoringEnabled: true
    });
});
