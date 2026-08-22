const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load(context, relativePath, names) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const exports = names.map(name => `this.${name} = ${name};`).join('\n');
    vm.runInContext(`${source}\n${exports}`, context, { filename: relativePath });
}

function loadDailySupport() {
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
        TextEncoder
    });
    load(context, 'js/utils/constants.js', ['CONSTANTS']);
    load(context, 'js/managers/RhythmManager.js', ['RhythmManager']);
    load(context, 'js/core/AngularCollisionRules.js', ['AngularCollisionRules']);
    load(context, 'js/core/GameSession.js', ['GameSession']);
    load(context, 'js/core/ReplayProtocol.js', ['ReplayProtocol']);
    load(context, 'js/core/ReplayRecorder.js', ['ReplayRecorder']);
    load(context, 'js/core/ScoreSession.js', ['ScoreSession']);

    const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
    const supportSource = mainSource.slice(0, mainSource.indexOf('const DAILY_CHALLENGES'));
    vm.runInContext(
        `${supportSource}\nthis.DailyChallengeStore = DailyChallengeStore;`
            + '\nthis.ScoreReplayVerifier = ScoreReplayVerifier;'
            + '\nthis.DailyChallengeService = DailyChallengeService;',
        context,
        { filename: 'js/main.js' }
    );
    return context;
}

function level() {
    return {
        id: 1,
        packId: 'pack',
        packVersion: '1.0.0',
        packLevelId: 'level-1',
        order: 1,
        name: 'One',
        rule: '',
        needleCount: 1,
        layout: { id: 'clear', obstacleAngles: [] },
        rhythm: { segments: [{ durationMs: 4000, velocity: 0.4 }] },
        designIntent: { tier: 1, milestone: false },
        scoring: {
            profileId: 'test-profile',
            parTimeMs: 10000,
            comboWindowMs: 3000
        }
    };
}

function storage() {
    const values = new Map();
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

test('daily challenge selection is stable for UTC date and pack version', () => {
    const { DailyChallengeService } = loadDailySupport();
    const levels = Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        packLevelId: `level-${index + 1}`,
        order: index + 1,
        name: `Level ${index + 1}`
    }));
    const context = {
        getActivePackId: () => 'pack',
        catalog: {
            getPack: () => ({ id: 'pack', version: '1.0.0' }),
            listLevels: () => levels
        },
        router: {
            startMenu() {},
            startLevelBrowser() {},
            startLevel() {}
        }
    };
    const service = new DailyChallengeService(context, {
        store: { getBest: () => null, listRecent: () => [] },
        activeStorage: null
    });
    const date = new Date('2026-08-22T23:59:00.000Z');
    const first = service.getToday('pack', date);
    const second = service.getToday('pack', date);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)));
    assert.equal(first.dateKey, '2026-08-22');
    assert.match(first.id, /^daily:2026-08-22:pack:level-/);
});

test('daily challenge starts in test mode so progression is not unlocked', () => {
    const { DailyChallengeService } = loadDailySupport();
    let started = null;
    const context = {
        getActivePackId: () => 'pack',
        catalog: {
            getPack: () => ({ id: 'pack', version: '1.0.0' }),
            listLevels: () => [{
                id: 1,
                packLevelId: 'level-1',
                order: 1,
                name: 'One'
            }]
        },
        router: {
            startMenu() {},
            startLevelBrowser() {},
            startLevel(scene, route) {
                started = route;
            }
        }
    };
    const service = new DailyChallengeService(context, {
        store: { getBest: () => null, listRecent: () => [] },
        activeStorage: null
    });
    service.start({}, 'pack');
    assert.equal(started.mode, 'test');
    assert.equal(service.matchRoute(started).levelId, 'level-1');
});

test('replay verifier recomputes an identical score from gameplay commands', () => {
    const {
        ReplayRecorder,
        ScoreSession,
        ScoreReplayVerifier
    } = loadDailySupport();
    const config = level();
    const recorder = new ReplayRecorder(config);
    recorder.advance(5000);
    assert.equal(recorder.beginShot().accepted, true);
    recorder.advance(100);
    const outcome = recorder.resolveImpact();
    assert.equal(outcome.completed, true);
    const replay = recorder.export();

    const score = new ScoreSession(config, { enabled: true });
    score.start();
    score.advance(100);
    score.recordInsertion(outcome.placement);
    score.complete();

    const verification = new ScoreReplayVerifier().verify({
        replay,
        levelConfig: config,
        score: score.getSnapshot()
    });
    assert.equal(verification.verified, true);
    assert.equal(verification.score.elapsedMs, 100);
    assert.equal(typeof verification.verificationDigest, 'string');
});

test('replay verifier rejects a claimed score changed after the run', () => {
    const {
        ReplayRecorder,
        ScoreSession,
        ScoreReplayVerifier
    } = loadDailySupport();
    const config = level();
    const recorder = new ReplayRecorder(config);
    recorder.beginShot();
    recorder.advance(100);
    const outcome = recorder.resolveImpact();
    const replay = recorder.export();
    const score = new ScoreSession(config, { enabled: true });
    score.start();
    score.advance(100);
    score.recordInsertion(outcome.placement);
    score.complete();
    const claimed = JSON.parse(JSON.stringify(score.getSnapshot()));
    claimed.score += 9999;

    const verification = new ScoreReplayVerifier().verify({
        replay,
        levelConfig: config,
        score: claimed
    });
    assert.equal(verification.verified, false);
    assert.equal(verification.reason, 'score-mismatch');
});

test('daily store accepts verified runs and applies deterministic tie-breaks', () => {
    const { DailyChallengeStore } = loadDailySupport();
    const store = new DailyChallengeStore({
        storage: storage(),
        clock: () => '2026-08-22T00:00:00.000Z'
    });
    const challenge = {
        id: 'daily:2026-08-22:pack:level-1',
        dateKey: '2026-08-22',
        packId: 'pack',
        levelId: 'level-1',
        levelOrder: 1,
        levelName: 'One'
    };
    const verification = {
        verified: true,
        replayDigest: 'replay-a',
        verificationDigest: 'verify-a',
        profileId: 'profile-a',
        score: { score: 1000, elapsedMs: 5000, maxCombo: 4 }
    };
    const first = store.recordVerified({ challenge, verification });
    assert.equal(first.accepted, true);
    assert.equal(first.isDailyBest, true);

    const slower = store.recordVerified({
        challenge,
        verification: {
            ...verification,
            replayDigest: 'replay-b',
            verificationDigest: 'verify-b',
            score: { score: 1000, elapsedMs: 6000, maxCombo: 5 }
        }
    });
    assert.equal(slower.isDailyBest, false);
    assert.equal(store.getBest(challenge.id).elapsedMs, 5000);
});
