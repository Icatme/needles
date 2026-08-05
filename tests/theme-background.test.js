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

function createDisplayObject(type, x = 0, y = 0) {
    return {
        type,
        x,
        y,
        alpha: 1,
        children: [],
        destroyed: false,
        add(child) {
            if (Array.isArray(child)) this.children.push(...child);
            else this.children.push(child);
            return this;
        },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
        destroy(includeChildren) {
            this.destroyed = true;
            this.destroyedChildren = includeChildren;
        }
    };
}

function createGraphics() {
    const graphics = createDisplayObject('graphics');
    graphics.commands = [];
    [
        'fillStyle', 'fillRect', 'fillRoundedRect', 'lineStyle',
        'strokeRoundedRect', 'fillEllipse', 'fillCircle', 'lineBetween',
        'strokeCircle', 'fillTriangle', 'beginPath', 'arc', 'strokePath'
    ].forEach(method => {
        graphics[method] = (...args) => {
            graphics.commands.push([method, ...args]);
            return graphics;
        };
    });
    return graphics;
}

function createScene() {
    const graphics = [];
    const tweens = [];
    const events = new Map();
    return {
        graphics,
        tweenConfigs: tweens,
        add: {
            container(x, y) { return createDisplayObject('container', x, y); },
            graphics() {
                const item = createGraphics();
                graphics.push(item);
                return item;
            }
        },
        tweens: {
            add(config) {
                const tween = {
                    config,
                    removed: false,
                    remove() { this.removed = true; }
                };
                tweens.push(tween);
                return tween;
            }
        },
        events: {
            once(name, callback) { events.set(name, callback); }
        },
        emit(name) {
            const callback = events.get(name);
            if (callback) callback();
        }
    };
}

const storage = new Map();
const context = vm.createContext({
    console,
    Math,
    Number,
    Object,
    localStorage: {
        getItem(key) { return storage.get(key) || null; },
        setItem(key, value) { storage.set(key, value); }
    },
    window: {
        matchMedia() { return { matches: false }; }
    }
});

loadIntoContext(context, 'js/utils/constants.js', 'CONSTANTS');
loadIntoContext(context, 'js/app/LayoutProfiles.js', 'LAYOUT_PROFILES');
loadIntoContext(context, 'js/app/LayoutManager.js', 'LayoutManager');
loadIntoContext(context, 'js/utils/ThemeBackground.js', 'ThemeBackground');
loadIntoContext(context, 'js/utils/SceneUI.js', 'SceneUI');

test('the two theme backgrounds use different structural languages', () => {
    const observatoryScene = createScene();
    const jewelScene = createScene();
    const observatory = context.ThemeBackground.create(
        observatoryScene,
        'game',
        'clockwork-observatory'
    );
    const jewel = context.ThemeBackground.create(
        jewelScene,
        'game',
        'gilded-jewel-box'
    );

    const observatoryCommands = observatoryScene.graphics.flatMap(item => item.commands);
    const jewelCommands = jewelScene.graphics.flatMap(item => item.commands);

    assert.equal(observatory.themeId, 'clockwork-observatory');
    assert.equal(jewel.themeId, 'gilded-jewel-box');
    assert.equal(observatory.animationCount, 2);
    assert.equal(jewel.animationCount, 2);
    assert.equal(observatoryCommands.some(([name]) => name === 'fillTriangle'), false);
    assert.equal(jewelCommands.filter(([name]) => name === 'fillTriangle').length, 4);
    assert.equal(
        observatoryCommands.some(command => command[0] === 'fillCircle' && command[1] === 58),
        true
    );
    assert.equal(
        jewelCommands.filter(([name]) => name === 'strokeRoundedRect').length >= 3,
        true
    );
    assert.notDeepEqual(observatoryCommands, jewelCommands);
});

test('reduced motion keeps both backgrounds static', () => {
    context.window.matchMedia = () => ({ matches: true });
    const scene = createScene();
    const background = context.ThemeBackground.create(
        scene,
        'menu',
        'gilded-jewel-box'
    );

    assert.equal(background.animationCount, 0);
    assert.equal(scene.tweenConfigs.length, 0);

    context.window.matchMedia = () => ({ matches: false });
});

test('scene shutdown leaves tween cleanup to Phaser and destroys the background tree', () => {
    const scene = createScene();
    const background = context.ThemeBackground.create(
        scene,
        'game',
        'clockwork-observatory'
    );

    scene.emit('shutdown');

    assert.equal(background.destroyed, true);
    assert.equal(background.destroyedChildren, true);
    assert.equal(scene.tweenConfigs.every(tween => tween.removed === false), true);
});

test('game-over backgrounds stop ambient animation and add a result treatment', () => {
    const scene = createScene();
    const background = context.ThemeBackground.create(
        scene,
        'result',
        'clockwork-observatory'
    );
    const commands = scene.graphics.flatMap(item => item.commands);

    assert.equal(background.mode, 'game-over');
    assert.equal(background.animationCount, 0);
    assert.equal(scene.tweenConfigs.length, 0);
    assert.equal(
        commands.some(command => command[0] === 'fillStyle' && command[1] === 0x081015),
        true
    );
});

test('theme UI palettes preserve foreground contrast on dark backgrounds', () => {
    const observatory = context.SceneUI.getPalette('clockwork-observatory');
    const jewel = context.SceneUI.getPalette('gilded-jewel-box');

    assert.equal(observatory.TEXT_COLOR, '#edf2ef');
    assert.equal(jewel.TEXT_COLOR, '#f6ebe5');
    assert.notEqual(observatory.BACKGROUND, jewel.BACKGROUND);
    assert.notEqual(observatory.PRIMARY_FILL, jewel.PRIMARY_FILL);
    assert.notEqual(observatory.ACTION_OUTLINE, jewel.ACTION_OUTLINE);
});
