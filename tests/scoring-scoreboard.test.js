const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadScene() {
    class BaseGameOverScene {
        init(data = {}) {
            this.route = data.route || { mode: 'progression' };
            this.success = Boolean(data.success);
            this.level = data.level || 1;
            this.insertedCount = data.insertedCount || 0;
            this.totalCount = data.totalCount || 0;
        }

        createMetricPanel() {
            this.usedBaseMetric = true;
        }
    }
    const context = vm.createContext({
        console,
        Math,
        String,
        Boolean,
        GameOverScene: BaseGameOverScene,
        ScoringHUD: {
            formatElapsed: value => String(value)
        }
    });
    const source = fs.readFileSync(
        path.join(root, 'js/features/scoring/ScoringGameOverScene.js'),
        'utf8'
    );
    vm.runInContext(
        `${source}\nthis.ScoringGameOverScene = ScoringGameOverScene;`,
        context,
        { filename: 'js/features/scoring/ScoringGameOverScene.js' }
    );
    return context.ScoringGameOverScene;
}

test('result breakdown keeps all score categories explicit', () => {
    const Scene = loadScene();
    assert.equal(
        Scene.formatBreakdown({
            base: 600,
            precision: 180,
            combo: 120,
            time: 350
        }),
        '基础 600  ·  精准 180  ·  连击 120  ·  速度 350'
    );
});

test('result labels distinguish new best, test mode and incomplete runs', () => {
    const Scene = loadScene();
    const best = new Scene();
    best.init({
        route: { mode: 'progression' },
        success: true,
        scoringEnabled: true,
        score: { score: 1000 },
        scoreRecord: {
            isPersonalBest: true,
            best: { score: 1000 }
        }
    });
    assert.equal(best.getRecordLabel(), 'NEW BEST · 新纪录');

    const testMode = new Scene();
    testMode.init({
        route: { mode: 'test' },
        success: true,
        scoringEnabled: true,
        score: { score: 1000 }
    });
    assert.equal(testMode.getRecordLabel(), '测试模式 · 不入榜');

    const failed = new Scene();
    failed.init({
        route: { mode: 'progression' },
        success: false,
        scoringEnabled: true,
        score: { score: 400 }
    });
    assert.equal(failed.getRecordLabel(), '未完成 · 不入榜');
});
