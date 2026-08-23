const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

function loadSupport(options = {}) {
    const context = vm.createContext({
        console,
        Math,
        Number,
        String,
        Boolean,
        JSON,
        Object,
        Array,
        Date,
        Map,
        Set,
        window: options.window,
        navigator: options.navigator,
        SceneUI: {
            prefersReducedMotion: () => Boolean(options.reducedMotion)
        }
    });
    const source = fs.readFileSync(
        path.join(root, 'js/app/GamePreferencesStore.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\nthis.GamePreferencesStore = GamePreferencesStore;`
            + '\nthis.FeedbackSignalController = FeedbackSignalController;'
            + '\nthis.ConfigurableScoringFeedback = ConfigurableScoringFeedback;'
            + '\nthis.FeedbackSettingsModal = FeedbackSettingsModal;',
        context,
        { filename: 'js/app/GamePreferencesStore.js' }
    );
    return context;
}

test('new installations keep scoring and visual feedback enabled but audio opt-in', () => {
    const { GamePreferencesStore } = loadSupport();
    const store = new GamePreferencesStore({ storage: null });
    assert.equal(store.isScoringEnabled(), true);
    assert.equal(store.isScoreHudEnabled(), true);
    assert.equal(store.isGhostEnabled(), true);
    assert.equal(store.isRewardTextEnabled(), true);
    assert.equal(store.getAnimationIntensity(), 'full');
    assert.equal(store.isSoundEnabled(), false);
    assert.equal(store.isHapticsEnabled(), false);
});

test('version-one scoring preference migrates without enabling audio or haptics', () => {
    const { GamePreferencesStore } = loadSupport();
    const storage = createStorage({
        preferences: JSON.stringify({
            version: 1,
            scoringEnabled: false
        })
    });
    const store = new GamePreferencesStore({
        storage,
        storageKey: 'preferences'
    });
    const snapshot = store.snapshot();
    assert.equal(snapshot.version, 2);
    assert.equal(snapshot.scoringEnabled, false);
    assert.equal(snapshot.scoreHudEnabled, true);
    assert.equal(snapshot.soundEnabled, false);
    assert.equal(snapshot.hapticsEnabled, false);
});

test('all granular toggles persist in one versioned preference record', () => {
    const { GamePreferencesStore } = loadSupport();
    const storage = createStorage();
    const store = new GamePreferencesStore({ storage, storageKey: 'preferences' });
    store.toggleScoreHud();
    store.toggleGhost();
    store.toggleRewardText();
    store.setAnimationIntensity('reduced');
    store.toggleSound();
    store.toggleHaptics();

    const restored = new GamePreferencesStore({ storage, storageKey: 'preferences' });
    assert.deepEqual(JSON.parse(JSON.stringify(restored.getFeedbackSettings())), {
        scoreHudEnabled: false,
        ghostEnabled: false,
        rewardTextEnabled: false,
        animationIntensity: 'reduced',
        soundEnabled: true,
        hapticsEnabled: true
    });
});

test('animation intensity cycles through full, reduced and off', () => {
    const { GamePreferencesStore } = loadSupport();
    const store = new GamePreferencesStore({ storage: null });
    assert.equal(store.cycleAnimationIntensity(), 'reduced');
    assert.equal(store.cycleAnimationIntensity(), 'off');
    assert.equal(store.cycleAnimationIntensity(), 'full');
    assert.equal(store.setAnimationIntensity('invalid'), 'full');
});

test('system reduced-motion preference caps a full animation setting', () => {
    const {
        GamePreferencesStore,
        FeedbackSignalController
    } = loadSupport({ reducedMotion: true });
    const store = new GamePreferencesStore({ storage: null });
    const signals = new FeedbackSignalController(store);
    assert.equal(signals.motionMode(), 'reduced');
    store.setAnimationIntensity('off');
    assert.equal(signals.motionMode(), 'off');
});

test('sound and haptics fail closed when browser capabilities are unavailable', () => {
    const {
        GamePreferencesStore,
        FeedbackSignalController
    } = loadSupport();
    const store = new GamePreferencesStore({ storage: null });
    store.setSoundEnabled(true);
    store.setHapticsEnabled(true);
    const signals = new FeedbackSignalController(store);
    assert.equal(signals.playTone('close'), false);
    assert.equal(signals.vibrate('threaded'), false);
});

test('reset feedback preserves the master scoring switch', () => {
    const { GamePreferencesStore } = loadSupport();
    const store = new GamePreferencesStore({ storage: null });
    store.setScoringEnabled(false);
    store.setScoreHudEnabled(false);
    store.setSoundEnabled(true);
    store.resetFeedback();
    assert.equal(store.isScoringEnabled(), false);
    assert.equal(store.isScoreHudEnabled(), true);
    assert.equal(store.isSoundEnabled(), false);
});

test('configurable feedback remains a presentation-only component', () => {
    const source = fs.readFileSync(
        path.join(root, 'js/app/GamePreferencesStore.js'),
        'utf8'
    );
    const start = source.indexOf('class ConfigurableScoringFeedback');
    const end = source.indexOf('class FeedbackSettingsModal');
    const component = source.slice(start, end);
    assert.doesNotMatch(component, /resolveImpact|beginShot|releaseShotLock/);
    assert.doesNotMatch(component, /score\s*\+=|breakdown\./);
    assert.match(component, /showInsertion/);
    assert.match(component, /showCompletion/);
});

test('precision-combo milestones take precedence over placement copy', () => {
    const { ConfigurableScoringFeedback } = loadSupport();
    const feedback = ConfigurableScoringFeedback.prototype;
    const award = {
        combo: 3,
        comboMilestone: 'triple',
        comboRestarted: false,
        precision: { kind: 'threaded' }
    };

    const kind = feedback.getInsertionKind(award);
    assert.equal(kind, 'combo');
    assert.equal(feedback.getInsertionLabel(award, kind), '精准连击 ×3');
});
