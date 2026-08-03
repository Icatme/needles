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

function createGraphicsRecorder() {
    const calls = [];
    const record = (name, args) => {
        calls.push([name, ...Array.from(args, value => (
            typeof value === 'number' ? Number(value.toFixed(5)) : value
        ))]);
    };

    return {
        calls,
        clear() { record('clear', arguments); return this; },
        setDepth(depth) { this.depth = depth; record('setDepth', arguments); return this; },
        setPosition() { record('setPosition', arguments); return this; },
        setRotation() { record('setRotation', arguments); return this; },
        fillStyle() { record('fillStyle', arguments); return this; },
        fillCircle() { record('fillCircle', arguments); return this; },
        fillTriangle() { record('fillTriangle', arguments); return this; },
        fillPath() { record('fillPath', arguments); return this; },
        lineStyle() { record('lineStyle', arguments); return this; },
        lineBetween() { record('lineBetween', arguments); return this; },
        strokeCircle() { record('strokeCircle', arguments); return this; },
        beginPath() { record('beginPath', arguments); return this; },
        moveTo() { record('moveTo', arguments); return this; },
        lineTo() { record('lineTo', arguments); return this; },
        closePath() { record('closePath', arguments); return this; },
        arc() { record('arc', arguments); return this; },
        strokePath() { record('strokePath', arguments); return this; },
        destroy() { record('destroy', arguments); return this; }
    };
}

function createImageRecorder(x, y, key) {
    const image = createGraphicsRecorder();
    image.x = x;
    image.y = y;
    image.key = key;
    image.setDisplaySize = function setDisplaySize(width, height) {
        this.displayWidth = width;
        this.displayHeight = height;
        this.calls.push(['setDisplaySize', width, height]);
        return this;
    };
    image.setBlendMode = function setBlendMode(blendMode) {
        this.blendMode = blendMode;
        this.calls.push(['setBlendMode', blendMode]);
        return this;
    };
    image.setAlpha = function setAlpha(alpha) {
        this.alpha = alpha;
        this.calls.push(['setAlpha', Number(alpha.toFixed(5))]);
        return this;
    };
    image.setVisible = function setVisible(visible) {
        this.visible = visible;
        this.calls.push(['setVisible', visible]);
        return this;
    };
    return image;
}

function createScene() {
    let graphics;
    const images = [];
    return {
        add: {
            graphics() {
                graphics = createGraphicsRecorder();
                return graphics;
            },
            image(x, y, key) {
                const image = createImageRecorder(x, y, key);
                images.push(image);
                return image;
            }
        },
        get graphics() { return graphics; },
        images
    };
}

const context = vm.createContext({ console, Math });
loadIntoContext(context, 'js/utils/constants.js', 'CONSTANTS');
loadIntoContext(context, 'js/utils/GemRenderer.js', 'GemRenderer');
loadIntoContext(context, 'js/data/wheelVisuals.js', 'WHEEL_VISUALS');
loadIntoContext(context, 'js/data/jewelVisuals.js', 'JEWEL_VISUALS');
loadIntoContext(context, 'js/data/levels.js', 'LEVEL_DEFINITIONS');
loadIntoContext(context, 'js/entities/JewelWheelRenderer.js', 'JewelWheelRenderer');
loadIntoContext(context, 'js/entities/Wheel.js', 'Wheel');

const visuals = Array.from(context.WHEEL_VISUALS);
const jewelVisuals = Array.from(context.JEWEL_VISUALS);
const levels = Array.from(context.LEVEL_DEFINITIONS);

const structuralKeys = [
    'family',
    'rimStyle',
    'tickStyle',
    'tickCount',
    'majorEvery',
    'ringRadii',
    'spokeCount',
    'hubStyle',
    'motifVariant'
];
const jewelStructuralKeys = [
    'family',
    'braceletStyle',
    'settingCount',
    'haloRadii',
    'centerCut',
    'facetStyle',
    'needleCuts',
    'motifVariant'
];

function fieldValue(config, key) {
    return JSON.stringify(config[key]);
}

test('fifty level visuals are authored across five clockwork families', () => {
    assert.equal(visuals.length, 50);
    assert.deepEqual(visuals.map(visual => visual.id), Array.from({ length: 50 }, (_, i) => i + 1));
    assert.deepEqual(
        Array.from(new Set(visuals.map(visual => visual.family))),
        ['calibration', 'geartrain', 'escapement', 'chronograph', 'orrery']
    );

    assert.equal(levels.length, visuals.length);
});

test('jewel box adds fifty authored visuals in five jewelry families', () => {
    assert.equal(jewelVisuals.length, 50);
    assert.deepEqual(
        jewelVisuals.map(visual => visual.id),
        Array.from({ length: 50 }, (_, i) => i + 1)
    );
    assert.deepEqual(
        Array.from(new Set(jewelVisuals.map(visual => visual.family))),
        ['pearl-bangle', 'floral-cluster', 'prism-cut', 'celestial-charm', 'royal-parure']
    );
});

test('every structural visual signature is unique and adjacent levels differ materially', () => {
    const signatures = visuals.map(visual => JSON.stringify(
        structuralKeys.map(key => visual[key])
    ));
    assert.equal(new Set(signatures).size, 50);

    for (let index = 1; index < visuals.length; index++) {
        const changedFields = structuralKeys.filter(key => (
            fieldValue(visuals[index - 1], key) !== fieldValue(visuals[index], key)
        ));
        assert.ok(
            changedFields.length >= 2,
            `levels ${index} and ${index + 1} changed only ${changedFields.join(', ')}`
        );
    }
});

test('jewel visuals are structurally unique and adjacent levels change materially', () => {
    const signatures = jewelVisuals.map(visual => JSON.stringify(
        jewelStructuralKeys.map(key => visual[key])
    ));
    assert.equal(new Set(signatures).size, 50);

    for (let index = 1; index < jewelVisuals.length; index++) {
        const changedFields = jewelStructuralKeys.filter(key => (
            fieldValue(jewelVisuals[index - 1], key) !== fieldValue(jewelVisuals[index], key)
        ));
        assert.ok(
            changedFields.length >= 2,
            `jewel levels ${index} and ${index + 1} changed only ${changedFields.join(', ')}`
        );
    }
});

test('chapter milestones receive the authored crown treatment', () => {
    visuals.forEach(visual => {
        if (visual.id % 10 === 0) {
            assert.equal(visual.milestone, true);
            assert.equal(visual.rimStyle, 'crown');
            assert.equal(visual.hubStyle, 'crown');
            assert.ok(visual.ringRadii.length >= 3);
        } else {
            assert.equal(visual.milestone, false);
        }
    });

    jewelVisuals.forEach(visual => {
        if (visual.id % 10 === 0) {
            assert.equal(visual.milestone, true);
            assert.equal(visual.braceletStyle, 'tiara');
            assert.equal(visual.facetStyle, 'crown');
            assert.ok(visual.haloRadii.length >= 4);
        } else {
            assert.equal(visual.milestone, false);
        }
    });
});

test('jewel wheel uses the ChatGPT specular asset as fixed screen-space light', () => {
    const jewelScene = createScene();
    const wheel = new context.Wheel(
        jewelScene,
        context.CONSTANTS.WHEEL.CENTER_X,
        context.CONSTANTS.WHEEL.CENTER_Y,
        context.CONSTANTS.WHEEL.RADIUS,
        jewelVisuals[0]
    );

    assert.equal(jewelScene.images.length, 1);
    assert.equal(wheel.specularImage.key, 'jewel-wheel-specular');
    assert.equal(wheel.specularImage.blendMode, 'SCREEN');
    assert.equal(wheel.specularImage.depth, 13);
    assert.ok(wheel.specularImage.calls.some(call => (
        call[0] === 'setDepth' && call[1] === 13
    )));
    assert.equal(
        wheel.specularImage.calls.filter(call => call[0] === 'setRotation').length,
        0
    );
    assert.equal(wheel.radius, context.CONSTANTS.WHEEL.RADIUS);

    const clockworkScene = createScene();
    new context.Wheel(
        clockworkScene,
        context.CONSTANTS.WHEEL.CENTER_X,
        context.CONSTANTS.WHEEL.CENTER_Y,
        context.CONSTANTS.WHEEL.RADIUS,
        visuals[0]
    );
    assert.equal(clockworkScene.images.length, 0);
});

test('jewel wheel omits the hard offset disc shadow', () => {
    const scene = createScene();
    new context.Wheel(
        scene,
        context.CONSTANTS.WHEEL.CENTER_X,
        context.CONSTANTS.WHEEL.CENTER_Y,
        context.CONSTANTS.WHEEL.RADIUS,
        jewelVisuals[0]
    );

    const oversizedOffsetCircles = scene.graphics.calls.filter(call => (
        call[0] === 'fillCircle'
        && call[2] > 0
        && call[3] > context.CONSTANTS.WHEEL.RADIUS
    ));
    assert.deepEqual(oversizedOffsetCircles, []);
});

test('all fifty configs render to distinct vector command streams', () => {
    const signatures = [...visuals, ...jewelVisuals].map(visual => {
        const scene = createScene();
        new context.Wheel(
            scene,
            context.CONSTANTS.WHEEL.CENTER_X,
            context.CONSTANTS.WHEEL.CENTER_Y,
            context.CONSTANTS.WHEEL.RADIUS,
            visual
        );
        return JSON.stringify(scene.graphics.calls);
    });

    assert.equal(new Set(signatures).size, 100);
});

test('all decorative geometry in both themes stays inside the true wheel silhouette', () => {
    [...visuals, ...jewelVisuals].forEach(visual => {
        const scene = createScene();
        new context.Wheel(
            scene,
            context.CONSTANTS.WHEEL.CENTER_X,
            context.CONSTANTS.WHEEL.CENTER_Y,
            context.CONSTANTS.WHEEL.RADIUS,
            visual
        );

        const circles = scene.graphics.calls.filter(call => (
            call[0] === 'fillCircle' || call[0] === 'strokeCircle'
        ));
        // 机械主题仍保留首个投影圆；珠宝主题从真实盘面开始，后续全部是盘内装饰。
        const firstDecoration = visual.theme === 'gilded-jewel-box' ? 1 : 2;
        circles.slice(firstDecoration).forEach(call => {
            const isFunctionalOutline = call[0] === 'strokeCircle'
                && call[3] === context.CONSTANTS.WHEEL.RADIUS;
            assert.ok(
                isFunctionalOutline || call[3] < context.CONSTANTS.WHEEL.RADIUS,
                `level ${visual.id} drew radius ${call[3]} outside the wheel`
            );
        });

        scene.graphics.calls
            .filter(call => call[0] === 'arc')
            .forEach(call => {
                assert.ok(call[3] < context.CONSTANTS.WHEEL.RADIUS);
            });
    });
});
