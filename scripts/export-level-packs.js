const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

function evaluate(relativePath, context, exports) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    const bridge = exports.map(name => `this.${name} = ${name};`).join('\n');
    vm.runInContext(`${source}\n${bridge}`, context, { filename: relativePath });
}

function writeJson(relativePath, value) {
    const target = path.join(root, relativePath);
    const content = `${JSON.stringify(value, null, 2)}\n`;

    if (checkOnly) {
        if (!fs.existsSync(target)) {
            throw new Error(`Generated pack file is missing: ${relativePath}`);
        }
        const existing = fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n');
        if (existing !== content) {
            throw new Error(`Generated pack file is stale: ${relativePath}`);
        }
        return;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
}

function stableLevelId(packId, numericId) {
    return `${packId}-${String(numericId).padStart(2, '0')}`;
}

function chapterId(chapter) {
    return `chapter-${chapter}`;
}

function exportPack({ id, title, caption, difficultyModel, chapters, levels }) {
    const layouts = {};
    const exportedLevels = levels.map(level => {
        const layoutId = level.layout.id;
        const existing = layouts[layoutId];
        const obstacleAngles = [...level.layout.obstacleAngles];

        if (existing && JSON.stringify(existing.obstacleAngles) !== JSON.stringify(obstacleAngles)) {
            throw new Error(`Layout ${layoutId} differs inside pack ${id}`);
        }
        layouts[layoutId] = { obstacleAngles };

        return {
            id: stableLevelId(id, level.id),
            legacyNumericId: level.id,
            chapterId: chapterId(level.chapter),
            order: level.id,
            title: level.name,
            instruction: level.rule,
            objective: {
                insertCount: level.needleCount
            },
            layoutRef: layoutId,
            rhythm: level.rhythm,
            presentation: {
                tier: level.designIntent?.tier ?? level.chapter,
                milestone: Boolean(level.designIntent?.milestone),
                ...(level.designIntent?.focus ? { focus: level.designIntent.focus } : {})
            },
            tags: level.designIntent?.focus ? [level.designIntent.focus] : []
        };
    });

    const directory = `packs/${id}`;
    writeJson(`${directory}/manifest.json`, {
        schema: 'needles.level-pack/v1',
        id,
        version: '1.0.0',
        title,
        caption,
        engineCompatibility: 'classic-v1',
        difficultyModel,
        chapters: chapters.map((name, index) => ({
            id: chapterId(index + 1),
            order: index + 1,
            title: name
        })),
        resources: {
            presets: 'presets.json',
            levels: 'levels.json'
        }
    });
    writeJson(`${directory}/presets.json`, {
        schema: 'needles.level-presets/v1',
        layouts
    });
    writeJson(`${directory}/levels.json`, {
        schema: 'needles.level-list/v1',
        levels: exportedLevels
    });
}

const context = vm.createContext({ console, Math, Number, JSON, Object, Array });
evaluate('js/data/levels.js', context, ['LEVEL_LAYOUTS', 'LEVEL_DEFINITIONS']);
evaluate('js/data/balancedLevels.js', context, [
    'BALANCED_LEVEL_DEFINITIONS',
    'LEVEL_PACKS',
    'DEFAULT_LEVEL_PACK_ID'
]);

const packs = Object.values(context.LEVEL_PACKS);
packs.forEach(pack => exportPack({
    id: pack.id,
    title: pack.name,
    caption: pack.caption,
    difficultyModel: pack.difficultyModel,
    chapters: [...pack.chapters],
    levels: Array.from(pack.levels)
}));

writeJson('packs/index.json', {
    schema: 'needles.pack-index/v1',
    defaultPackId: context.DEFAULT_LEVEL_PACK_ID,
    packs: packs.map(pack => ({
        id: pack.id,
        manifest: `${pack.id}/manifest.json`
    }))
});

console.log(
    `${checkOnly ? 'Verified' : 'Exported'} ${packs.length} packs and `
        + `${packs.reduce((sum, pack) => sum + pack.levels.length, 0)} levels.`
);
