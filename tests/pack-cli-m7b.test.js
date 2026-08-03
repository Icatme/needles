const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    auditPack,
    createPackReport,
    createStarterPack,
    diffPacks,
    renderPackReportHtml,
    scorePack
} = require('../scripts/lib/pack-toolkit');

const root = path.resolve(__dirname, '..');

function temporaryDirectory(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('audit and score use the same resolved fifty-level runtime pack', () => {
    const audit = auditPack(root, 'balanced-v2');
    const scores = scorePack(root, 'balanced-v2');

    assert.equal(audit.schema, 'needles.pack-audit/v1');
    assert.equal(audit.levelCount, 50);
    assert.equal(audit.validLevelCount, 50);
    assert.equal(audit.errorCount, 0);
    assert.equal(scores.levels.length, 50);
    assert.equal(scores.levels.every(level => Number.isFinite(level.score)), true);
    assert.deepEqual(
        scores.levels.map(level => level.levelId),
        audit.levels.map(level => level.levelId)
    );
});

test('pack report exposes chapters, score range and escaped standalone HTML', () => {
    const report = createPackReport(root, 'balanced-v2');
    const html = renderPackReportHtml({
        ...report,
        title: '<script>unsafe</script>'
    });

    assert.equal(report.schema, 'needles.pack-report/v1');
    assert.equal(report.chapterCount, 5);
    assert.equal(report.levelCount, 50);
    assert.equal(report.valid, true);
    assert.equal(Number.isFinite(report.scoreRange.minimum), true);
    assert.equal(Number.isFinite(report.scoreRange.maximum), true);
    assert.equal(report.adjacentChanges.length, 49);
    assert.doesNotMatch(html, /<script>unsafe<\/script>/);
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.match(html, /关卡曲线/);
});

test('diff identifies stable-id gameplay changes in a copied pack', () => {
    const temporaryRoot = temporaryDirectory('needles-pack-diff-');
    const directory = path.join(temporaryRoot, 'candidate-pack');
    fs.cpSync(
        path.join(root, 'packs/balanced-v2'),
        directory,
        { recursive: true }
    );
    const levelsPath = path.join(directory, 'levels.json');
    const levels = JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
    levels.levels[9].rhythm.segments[0].velocity += 0.05;
    fs.writeFileSync(levelsPath, `${JSON.stringify(levels, null, 2)}\n`);

    const diff = diffPacks(root, 'balanced-v2', directory);
    assert.equal(diff.schema, 'needles.pack-diff/v1');
    assert.equal(diff.summary.added, 0);
    assert.equal(diff.summary.removed, 0);
    assert.equal(diff.summary.changed, 1);
    assert.equal(diff.changed[0].levelId, 'balanced-v2-10');
    assert.deepEqual(diff.changed[0].fields, ['rhythm']);
    assert.notEqual(diff.changed[0].beforeHash, diff.changed[0].afterHash);
});

test('create generates a minimal pure-JSON starter pack', () => {
    const directory = temporaryDirectory('needles-pack-create-');
    fs.mkdirSync(path.join(directory, 'packs'), { recursive: true });
    fs.cpSync(path.join(root, 'schemas'), path.join(directory, 'schemas'), {
        recursive: true
    });

    const result = createStarterPack(directory, 'tutorial-pack', {
        title: '教学包',
        caption: '一关起步'
    });
    const manifest = JSON.parse(fs.readFileSync(
        path.join(result.directory, 'manifest.json'),
        'utf8'
    ));
    const levels = JSON.parse(fs.readFileSync(
        path.join(result.directory, 'levels.json'),
        'utf8'
    ));

    assert.equal(result.registered, false);
    assert.equal(manifest.id, 'tutorial-pack');
    assert.equal(manifest.title, '教学包');
    assert.equal(levels.levels.length, 1);
    assert.equal(levels.levels[0].id, 'tutorial-pack-01');
    assert.equal(levels.levels[0].objective.insertCount, 1);
    assert.equal(fs.existsSync(path.join(result.directory, 'plugin.js')), false);
});

test('pack CLI validate and report commands emit machine-readable output', () => {
    const validate = spawnSync(process.execPath, [
        path.join(root, 'scripts/pack.js'),
        'validate',
        '--root',
        root
    ], { encoding: 'utf8' });
    assert.equal(validate.status, 0, validate.stderr);
    assert.equal(JSON.parse(validate.stdout).levelCount, 100);

    const directory = temporaryDirectory('needles-pack-report-');
    const jsonPath = path.join(directory, 'report.json');
    const htmlPath = path.join(directory, 'report.html');
    const report = spawnSync(process.execPath, [
        path.join(root, 'scripts/pack.js'),
        'report',
        'balanced-v2',
        '--root',
        root,
        '--json',
        jsonPath,
        '--html',
        htmlPath
    ], { encoding: 'utf8' });

    assert.equal(report.status, 0, report.stderr);
    assert.equal(JSON.parse(fs.readFileSync(jsonPath, 'utf8')).levelCount, 50);
    assert.match(fs.readFileSync(htmlPath, 'utf8'), /<!doctype html>/);
});
