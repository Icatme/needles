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

function createDisplayObject() {
    return {
        x: 0,
        y: 0,
        rotation: 0,
        alpha: 1,
        visible: true,
        color: null,
        clear() { return this; },
        setDepth(depth) { this.depth = depth; return this; },
        lineStyle() { return this; },
        beginPath() { return this; },
        arc() { return this; },
        moveTo() { return this; },
        lineTo() { return this; },
        closePath() { return this; },
        fillPath() { this.fillPathCount = (this.fillPathCount || 0) + 1; return this; },
        strokePath() { return this; },
        fillStyle() { return this; },
        fillTriangle() { return this; },
        fillCircle() { return this; },
        strokeCircle() { return this; },
        lineBetween() { return this; },
        setOrigin() { return this; },
        setVisible(visible) { this.visible = visible; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setRotation(rotation) { this.rotation = rotation; return this; },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setDisplaySize(width, height) {
            this.displayWidth = width;
            this.displayHeight = height;
            return this;
        },
        setBlendMode(blendMode) { this.blendMode = blendMode; return this; },
        setColor(color) { this.color = color; return this; },
        destroy() { this.destroyed = true; }
    };
}

function createScene() {
    const images = [];
    const tweenConfigs = [];
    return {
        add: {
            graphics: () => createDisplayObject(),
            text: () => createDisplayObject(),
            image(x, y, key) {
                const image = createDisplayObject();
                image.x = x;
                image.y = y;
                image.key = key;
                images.push(image);
                return image;
            }
        },
        tweens: {
            add(config) {
                tweenConfigs.push(config);
                return config;
            }
        },
        images,
        tweenConfigs
    };
}

const context = vm.createContext({
    console,
    Math,
    localStorage: { getItem() { return null; } },
    window: { matchMedia() { return { matches: false }; } }
});
loadIntoContext(context, 'js/utils/constants.js', 'CONSTANTS');
loadIntoContext(context, 'js/utils/ThemeBackground.js', 'ThemeBackground');
loadIntoContext(context, 'js/utils/SceneUI.js', 'SceneUI');
loadIntoContext(context, 'js/utils/GemRenderer.js', 'GemRenderer');
loadIntoContext(context, 'js/data/wheelVisuals.js', 'WHEEL_VISUALS');
loadIntoContext(context, 'js/data/jewelVisuals.js', 'JEWEL_VISUALS');
loadIntoContext(context, 'js/entities/Needle.js', 'Needle');
loadIntoContext(context, 'js/entities/JewelWheelRenderer.js', 'JewelWheelRenderer');
loadIntoContext(context, 'js/entities/Wheel.js', 'Wheel');
loadIntoContext(context, 'js/entities/Obstacle.js', 'Obstacle');
loadIntoContext(context, 'js/managers/CollisionManager.js', 'CollisionManager');

const {
    CONSTANTS,
    WHEEL_VISUALS,
    JEWEL_VISUALS,
    Needle,
    Wheel,
    Obstacle,
    CollisionManager
} = context;

function closeTo(actual, expected, epsilon = 1e-7) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
}

test('attached needle penetrates far enough to hide the complete tip', () => {
    const scene = createScene();
    const needle = new Needle(scene, 1, WHEEL_VISUALS[0]);
    const wheel = {
        x: CONSTANTS.WHEEL.CENTER_X,
        y: CONSTANTS.WHEEL.CENTER_Y,
        radius: CONSTANTS.WHEEL.RADIUS,
        rotation: 0
    };

    needle.attachToWheel(wheel, Math.PI / 2);

    const cap = needle.getBallPosition();
    const tip = needle.getTipPosition();
    closeTo(cap.x, wheel.x);
    closeTo(
        cap.y,
        wheel.y + wheel.radius + CONSTANTS.NEEDLE.LENGTH - CONSTANTS.NEEDLE.INSERT_DEPTH
    );
    closeTo(tip.x, wheel.x);
    closeTo(tip.y, wheel.y + wheel.radius - CONSTANTS.NEEDLE.INSERT_DEPTH);
    assert.ok(CONSTANTS.NEEDLE.INSERT_DEPTH > CONSTANTS.NEEDLE.TIP_LENGTH);
    closeTo(needle.numberText.rotation, 0);
});

test('needle number remains upright at the top of the rotating wheel', () => {
    const needle = new Needle(createScene(), 2, WHEEL_VISUALS[0]);
    const wheel = {
        x: CONSTANTS.WHEEL.CENTER_X,
        y: CONSTANTS.WHEEL.CENTER_Y,
        radius: CONSTANTS.WHEEL.RADIUS,
        rotation: 0
    };

    needle.attachToWheel(wheel, -Math.PI / 2);

    const tip = needle.getTipPosition();
    closeTo(tip.x, wheel.x);
    closeTo(tip.y, wheel.y - wheel.radius + CONSTANTS.NEEDLE.INSERT_DEPTH);
    closeTo(needle.numberText.rotation, 0);
});

test('wheel renders above inserted tips while caps stay on the outer ring', () => {
    const scene = createScene();
    const wheel = new Wheel(
        scene,
        CONSTANTS.WHEEL.CENTER_X,
        CONSTANTS.WHEEL.CENTER_Y,
        CONSTANTS.WHEEL.RADIUS,
        WHEEL_VISUALS[0]
    );
    const needle = new Needle(scene, 2, WHEEL_VISUALS[0]);
    const obstacle = new Obstacle(scene, 0, WHEEL_VISUALS[0]);

    assert.ok(wheel.graphics.depth > needle.graphics.depth);
    assert.ok(wheel.graphics.depth > obstacle.graphics.depth);
});

test('launch speed is measured in pixels per second instead of normalized frames', () => {
    const needle = new Needle(createScene(), 3, WHEEL_VISUALS[0]);
    const targetY = CONSTANTS.WHEEL.CENTER_Y
        + CONSTANTS.WHEEL.RADIUS
        + CONSTANTS.NEEDLE.LENGTH
        - CONSTANTS.NEEDLE.INSERT_DEPTH;
    needle.setReadyPosition(300, CONSTANTS.NEEDLE.READY_Y);
    needle.launch(300, targetY);

    assert.equal(needle.update(16), false);
    assert.ok(needle.ballY < CONSTANTS.NEEDLE.READY_Y && needle.ballY > targetY);
    closeTo(
        CONSTANTS.NEEDLE.READY_Y - needle.ballY,
        CONSTANTS.NEEDLE.FLY_SPEED * 0.016
    );

    let reached = false;
    for (let i = 0; i < 20 && !reached; i++) {
        reached = needle.update(10);
    }

    assert.equal(reached, true);
    closeTo(needle.ballY, targetY);
});

test('ready needle clears the lowest attached cap and still has a visible fast flight', () => {
    const lowestAttachedCapEdge = CONSTANTS.WHEEL.CENTER_Y
        + CONSTANTS.WHEEL.RADIUS
        + CONSTANTS.NEEDLE.LENGTH
        - CONSTANTS.NEEDLE.INSERT_DEPTH
        + Math.max(CONSTANTS.NEEDLE.BALL_RADIUS, CONSTANTS.OBSTACLE.RADIUS);
    const readyTipY = CONSTANTS.NEEDLE.READY_Y - CONSTANTS.NEEDLE.LENGTH;
    const clearance = readyTipY - lowestAttachedCapEdge;
    const targetCapY = CONSTANTS.WHEEL.CENTER_Y
        + CONSTANTS.WHEEL.RADIUS
        + CONSTANTS.NEEDLE.LENGTH
        - CONSTANTS.NEEDLE.INSERT_DEPTH;
    const flightDurationMs = (
        (CONSTANTS.NEEDLE.READY_Y - targetCapY) / CONSTANTS.NEEDLE.FLY_SPEED
    ) * 1000;

    assert.ok(clearance >= 24, `ready needle clearance was only ${clearance}px`);
    assert.ok(flightDurationMs < 100, `flight took ${flightDurationMs}ms`);
    assert.ok(flightDurationMs >= 50, 'flight should remain visible for several frames');
});

test('wheel impact edge is fixed at six o’clock', () => {
    const wheel = new Wheel(
        createScene(),
        CONSTANTS.WHEEL.CENTER_X,
        CONSTANTS.WHEEL.CENTER_Y,
        CONSTANTS.WHEEL.RADIUS,
        WHEEL_VISUALS[0]
    );
    wheel.rotation = 1.73;

    const impact = wheel.getImpactEdgePosition();
    closeTo(impact.x, wheel.x);
    closeTo(impact.y, wheel.y + wheel.radius);
    closeTo(impact.angle, Math.PI / 2);
});

test('wheel applies exact rhythm deltas without owning another speed clock', () => {
    const wheel = new Wheel(
        createScene(),
        CONSTANTS.WHEEL.CENTER_X,
        CONSTANTS.WHEEL.CENTER_Y,
        CONSTANTS.WHEEL.RADIUS,
        WHEEL_VISUALS[0]
    );

    wheel.rotateBy(0.75);
    wheel.rotateBy(-0.2);

    closeTo(wheel.rotation, 0.55);
    closeTo(wheel.graphics.rotation, 0.55);
    assert.equal('rotationSpeed' in wheel, false);
});

test('obstacles share the needle-cap ring so collisions are reachable', () => {
    const scene = createScene();
    const wheel = {
        x: CONSTANTS.WHEEL.CENTER_X,
        y: CONSTANTS.WHEEL.CENTER_Y,
        radius: CONSTANTS.WHEEL.RADIUS,
        rotation: 0
    };
    const needle = new Needle(scene, 4, WHEEL_VISUALS[0]);
    const obstacle = new Obstacle(scene, 0, WHEEL_VISUALS[0]);
    const collisions = new CollisionManager();

    needle.attachToWheel(wheel, 0);
    obstacle.updatePosition(wheel);

    assert.equal(collisions.checkObstacleCollision(needle, [obstacle]).collided, true);
});

test('jewel theme replaces cap art with facets without changing collision geometry', () => {
    const scene = createScene();
    const visual = JEWEL_VISUALS[8];
    const needle = new Needle(scene, 9, visual);
    const obstacle = new Obstacle(scene, 0, visual);

    needle.setReadyPosition(300, CONSTANTS.NEEDLE.READY_Y);

    assert.ok(needle.graphics.fillPathCount >= 3, 'gem cap should draw polygonal layers');
    assert.ok(obstacle.graphics.fillPathCount >= 3, 'locked charm should draw polygonal layers');
    assert.equal(needle.getBallRadius(), CONSTANTS.NEEDLE.BALL_RADIUS);
    assert.equal(obstacle.getRadius(), CONSTANTS.OBSTACLE.RADIUS);
    assert.equal(typeof needle.numberText.color, 'string');
    assert.equal(needle.numberText.rotation, 0);
    assert.equal(needle.catchlightImage.key, 'jewel-gem-catchlight');
    assert.equal(needle.catchlightImage.blendMode, 'SCREEN');
    assert.equal(needle.catchlightImage.alpha, 0.98);
    assert.ok(needle.catchlightImage.displayWidth <= CONSTANTS.NEEDLE.BALL_RADIUS * 2);
});

test('jewel catchlight follows fixed upper-left lighting without changing hit radius', () => {
    const needle = new Needle(createScene(), 2, JEWEL_VISUALS[0]);
    const wheel = {
        x: CONSTANTS.WHEEL.CENTER_X,
        y: CONSTANTS.WHEEL.CENTER_Y,
        radius: CONSTANTS.WHEEL.RADIUS,
        rotation: 0
    };
    const lightAngle = -Math.PI * 0.72;

    needle.attachToWheel(wheel, lightAngle);
    const brightAlpha = needle.catchlightImage.alpha;
    wheel.rotation = Math.PI;
    needle.updateOnWheel(wheel);
    const dimAlpha = needle.catchlightImage.alpha;

    assert.ok(brightAlpha > dimAlpha);
    assert.ok(brightAlpha >= 0.97);
    assert.ok(dimAlpha >= 0.64);
    assert.equal(needle.catchlightImage.rotation, 0);
    assert.equal(needle.getBallRadius(), CONSTANTS.NEEDLE.BALL_RADIUS);
});

test('insertion catchlight animates opacity only and never recoils the needle', () => {
    const scene = createScene();
    const needle = new Needle(scene, 3, JEWEL_VISUALS[0]);
    const wheel = {
        x: CONSTANTS.WHEEL.CENTER_X,
        y: CONSTANTS.WHEEL.CENTER_Y,
        radius: CONSTANTS.WHEEL.RADIUS,
        rotation: 0
    };

    needle.attachToWheel(wheel, Math.PI / 2);
    const before = {
        x: needle.graphics.x,
        y: needle.graphics.y,
        rotation: needle.graphics.rotation
    };
    needle.playInsertionCatchlight();

    const tween = scene.tweenConfigs.at(-1);
    assert.equal(tween.targets, needle.catchlightImage);
    assert.equal(tween.duration, 160);
    assert.equal(tween.ease, 'Quad.easeOut');
    assert.equal(tween.yoyo, undefined);
    ['x', 'y', 'scale', 'scaleX', 'scaleY'].forEach(key => {
        assert.equal(tween[key], undefined);
    });
    assert.deepEqual(
        { x: needle.graphics.x, y: needle.graphics.y, rotation: needle.graphics.rotation },
        before
    );
});
