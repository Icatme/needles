const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function load(context, relativePath, names) {
    const exports = Array.isArray(names) ? names : [names];
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const bridge = exports.filter(Boolean)
        .map(name => `this.${name} = ${name};`)
        .join('\n');
    vm.runInContext(`${source}\n${bridge}`, context, { filename: relativePath });
}

test('HUD formats active play time to tenths', () => {
    const context = vm.createContext({
        console,
        Math,
        Number,
        String
    });
    load(context, 'js/features/scoring/ScoringHUD.js', 'ScoringHUD');

    assert.equal(context.ScoringHUD.formatElapsed(0), '00:00.0');
    assert.equal(context.ScoringHUD.formatElapsed(61543), '01:01.5');
    assert.equal(context.ScoringHUD.formatElapsed(-100), '00:00.0');
});

test('router merges scene result context without coupling to scoring', () => {
    const catalog = {
        getDefaultPackId: () => 'pack',
        getPack: () => ({
            id: 'pack',
            levels: [{ id: 1, packLevelId: 'level-1' }]
        }),
        getLevel: () => ({ id: 1, packLevelId: 'level-1' }),
        getNextLevel: () => null
    };
    const context = vm.createContext({ console, Object });
    load(context, 'js/app/AppRouter.js', 'AppRouter');
    const router = new context.AppRouter({ catalog });
    let transition = null;
    const scene = {
        scene: {
            start(key, payload) {
                transition = { key, payload };
            }
        },
        getResultContext() {
            return {
                score: { score: 1234 },
                scoringEnabled: true
            };
        }
    };

    router.startResult(scene, {
        route: { packId: 'pack', levelId: 'level-1' },
        success: true
    });

    assert.equal(transition.key, 'GameOverScene');
    assert.equal(transition.payload.score.score, 1234);
    assert.equal(transition.payload.scoringEnabled, true);
    assert.equal(transition.payload.route.levelId, 'level-1');
});

test('scoring scene starts timing on the first accepted shot and reports awards', () => {
    class BaseGameScene {
        create() {
            this.levelConfig = {
                id: 1,
                needleCount: 2,
                layout: { obstacleAngles: [] }
            };
            this.route = { mode: 'progression' };
            this.levelVisual = { theme: 'clockwork-observatory' };
            this.session = { status: 'ready' };
            this.currentNeedle = {
                getBallPosition: () => ({ x: 300, y: 400 })
            };
            this.completionHandled = false;
        }

        onScreenClick() {
            this.session.status = 'in-flight';
        }

        update() {}

        onNeedleInserted() {
            this.baseInserted = true;
        }

        onGameOver() {
            this.baseGameOver = true;
        }

        onLevelComplete() {
            this.completionHandled = true;
        }

        createCelebration() {
            this.baseCelebrated = true;
        }

        shutdown() {
            this.baseShutdown = true;
        }
    }

    class FakeScoreSession {
        constructor(level, options) {
            this.level = level;
            this.enabled = options.enabled;
            this.status = 'idle';
            this.elapsedMs = 0;
            this.score = 0;
            this.combo = 0;
        }

        start() {
            this.status = 'running';
        }

        advance(deltaMs) {
            if (this.status === 'running') this.elapsedMs += deltaMs;
        }

        recordInsertion() {
            this.combo++;
            this.score += 100;
            return {
                enabled: this.enabled,
                points: 100,
                combo: this.combo,
                precision: { kind: 'clear', sides: [] },
                comboMilestone: null
            };
        }

        fail() {
            this.status = 'failed';
        }

        complete() {
            this.status = 'completed';
            return {
                enabled: this.enabled,
                timeBonus: { kind: 'par', points: 200 }
            };
        }

        getSnapshot() {
            return {
                enabled: this.enabled,
                status: this.status,
                elapsedMs: this.elapsedMs,
                score: this.score,
                combo: this.combo
            };
        }
    }

    class FakeHud {
        constructor() {
            this.updates = [];
        }

        update(snapshot) {
            this.updates.push(snapshot);
        }

        destroy() {
            this.destroyed = true;
        }
    }

    class FakeFeedback {
        constructor() {
            this.insertions = [];
            this.completions = [];
        }

        showInsertion(award, position) {
            this.insertions.push({ award, position });
        }

        showCompletion(award) {
            this.completions.push(award);
        }

        destroyAll() {
            this.destroyed = true;
        }
    }

    const context = vm.createContext({
        console,
        Math,
        Boolean,
        GameScene: BaseGameScene,
        ScoreSession: FakeScoreSession,
        ScoringHUD: FakeHud,
        ScoringFeedback: FakeFeedback,
        GamePreferencesStore: class {},
        APP_CONTEXT: {
            preferences: {
                isScoringEnabled: () => true
            }
        }
    });
    load(
        context,
        'js/features/scoring/ScoringGameScene.js',
        'ScoringGameScene'
    );
    const scene = new context.ScoringGameScene();

    scene.create();
    assert.equal(scene.scoreSession.status, 'idle');
    scene.onScreenClick();
    assert.equal(scene.scoreSession.status, 'running');
    scene.update(0, 33);
    assert.equal(scene.scoreSession.elapsedMs, 33);

    scene.onNeedleInserted({ placement: { nearest: {} } });
    assert.equal(scene.scoreSession.score, 100);
    assert.equal(scene.scoringFeedback.insertions.length, 1);
    assert.equal(scene.baseInserted, true);

    scene.session.status = 'completed';
    scene.onLevelComplete();
    scene.createCelebration();
    const result = scene.getResultContext();
    assert.equal(result.score.status, 'completed');
    assert.equal(result.timeBonus.points, 200);
    assert.equal(result.scoreEligible, true);
    assert.equal(scene.scoringFeedback.completions.length, 1);

    scene.shutdown();
    assert.equal(scene.baseShutdown, true);
});

test('disabled challenge mode hides presentation and marks score ineligible', () => {
    class BaseGameScene {
        create() {
            this.levelConfig = {
                id: 1,
                needleCount: 1,
                layout: { obstacleAngles: [] }
            };
            this.route = { mode: 'progression' };
            this.levelVisual = {};
            this.session = { status: 'ready' };
            this.completionHandled = false;
        }

        onScreenClick() {}
        update() {}
        onNeedleInserted() {}
        onGameOver() {}
        onLevelComplete() {}
        createCelebration() {}
        shutdown() {}
    }

    class FakeScoreSession {
        constructor(level, options) {
            this.enabled = options.enabled;
            this.status = 'idle';
        }

        getSnapshot() {
            return { enabled: this.enabled, score: 0, elapsedMs: 0, combo: 0 };
        }
    }

    const context = vm.createContext({
        console,
        Math,
        Boolean,
        GameScene: BaseGameScene,
        ScoreSession: FakeScoreSession,
        ScoringHUD: class {},
        ScoringFeedback: class {},
        GamePreferencesStore: class {},
        APP_CONTEXT: {
            preferences: {
                isScoringEnabled: () => false
            }
        }
    });
    load(
        context,
        'js/features/scoring/ScoringGameScene.js',
        'ScoringGameScene'
    );
    const scene = new context.ScoringGameScene();

    scene.create();
    assert.equal(scene.scoringEnabled, false);
    assert.equal(scene.scoringHud, null);
    assert.equal(scene.scoringFeedback, null);
    assert.equal(scene.getResultContext().scoreEligible, false);
});
