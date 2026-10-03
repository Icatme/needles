const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('migration export preserves authored packs and still detects stale migration data', () => {
    const root = path.resolve(__dirname, '..');
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'needles-export-'));
    try {
        for (const directory of ['scripts', 'js/data', 'packs']) {
            fs.mkdirSync(path.dirname(path.join(temporaryRoot, directory)), { recursive: true });
            fs.cpSync(path.join(root, directory), path.join(temporaryRoot, directory), { recursive: true });
        }
        const run = (...args) => spawnSync(process.execPath,
            [path.join(temporaryRoot, 'scripts/export-level-packs.js'), ...args], { encoding: 'utf8' });
        const indexPath = path.join(temporaryRoot, 'packs/index.json');
        const indexBefore = fs.readFileSync(indexPath, 'utf8');
        const authoredPath = path.join(temporaryRoot, 'packs/readable-v3/levels.json');
        const authoredBefore = fs.readFileSync(authoredPath, 'utf8');
        assert.equal(run('--check').status, 0);
        assert.equal(run().status, 0);
        assert.equal(fs.readFileSync(indexPath, 'utf8'), indexBefore);
        assert.equal(fs.readFileSync(authoredPath, 'utf8'), authoredBefore);
        assert.equal(run('--check').status, 0);
        const migratedPath = path.join(temporaryRoot, 'packs/legacy/levels.json');
        fs.appendFileSync(migratedPath, '\n');
        const stale = run('--check');
        assert.notEqual(stale.status, 0);
        assert.match(stale.stderr, /Generated pack file is stale: packs\/legacy\/levels.json/);
    } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
});
