const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('GameScene delegates gameplay decisions to GameSession', () => {
    const source = read('js/scenes/GameScene.js');

    assert.match(source, /new GameSession\(this\.levelConfig\)/);
    assert.match(source, /this\.session\.beginShot\(\)/);
    assert.match(source, /this\.session\.advance\(frameDelta\)/);
    assert.match(source, /this\.session\.resolveImpact\(\)/);
    assert.match(source, /this\.session\.releaseShotLock\(\)/);

    assert.doesNotMatch(source, /new RhythmManager\(/);
    assert.doesNotMatch(source, /new CollisionManager\(/);
    assert.doesNotMatch(source, /checkAllCollisions/);
    assert.doesNotMatch(source, /recordSuccessfulInsert/);
    assert.doesNotMatch(source, /IMPACT_ANGLE\s*-\s*this\.wheel\.rotation/);
});

test('GameScene retains only animation and view responsibilities', () => {
    const source = read('js/scenes/GameScene.js');

    assert.match(source, /this\.currentNeedle\.launch\(/);
    assert.match(source, /this\.currentNeedle\.attachToWheel\(/);
    assert.match(source, /this\.wheel\.rotateBy\(frame\.rotationDelta\)/);
    assert.match(source, /this\.time\.delayedCall\(CONSTANTS\.DIFFICULTY\.INSERT_LOCK_MS/);
    assert.match(source, /this\.createImpactFeedback\(\)/);
    assert.match(source, /this\.createExplosion\(/);
    assert.match(source, /this\.createCelebration\(\)/);
});

test('render loop consumes lightweight frames instead of full snapshots', () => {
    const session = read('js/core/GameSession.js');
    const scene = read('js/scenes/GameScene.js');

    assert.match(session, /createFrame\(rotationDelta, rhythm\)/);
    assert.doesNotMatch(
        session.match(/advance\(deltaMs\)[\s\S]*?\n    beginShot\(\)/)?.[0] || '',
        /snapshot:\s*this\.getSnapshot\(\)/
    );
    assert.match(scene, /this\.session\.status === 'failed'/);
    assert.doesNotMatch(
        scene.match(/update\(time, delta\)[\s\S]*?\n    onNeedleReachedWheel\(\)/)?.[0] || '',
        /getSnapshot\(\)/
    );
});

test('browser entrypoint loads pure core and omits legacy collision runtime', () => {
    const html = read('index.html');

    assert.match(html, /js\/core\/AngularCollisionRules\.js/);
    assert.match(html, /js\/core\/GameSession\.js/);
    assert.doesNotMatch(html, /js\/managers\/CollisionManager\.js/);

    const rhythmIndex = html.indexOf('js/managers/RhythmManager.js');
    const collisionIndex = html.indexOf('js/core/AngularCollisionRules.js');
    const sessionIndex = html.indexOf('js/core/GameSession.js');
    const sceneIndex = html.indexOf('js/scenes/GameScene.js');
    assert.ok(rhythmIndex >= 0 && rhythmIndex < sessionIndex);
    assert.ok(collisionIndex >= 0 && collisionIndex < sessionIndex);
    assert.ok(sessionIndex < sceneIndex);
});
