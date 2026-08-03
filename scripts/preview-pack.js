#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { spawn } = require('node:child_process');
const { loadPack } = require('./lib/pack-toolkit');

const SKINS = new Set([
    'clockwork-observatory',
    'gilded-jewel-box'
]);

function main(argv) {
    const options = parseArguments(argv);
    if (options.help || !options.packId) {
        process.stdout.write(usage());
        return options.help ? 0 : 2;
    }

    const root = path.resolve(options.root || process.cwd());
    const loaded = loadPack(root, options.packId);
    if (options.lab && options.levelId !== null) {
        throw new Error('--lab and --level cannot be used together');
    }
    if (!options.lab && (options.chapterId || options.pageProvided)) {
        throw new Error('--chapter and --page require --lab');
    }
    if (!['test', 'progression'].includes(options.mode)) {
        throw new Error('--mode must be test or progression');
    }
    if (options.skinId && !SKINS.has(options.skinId)) {
        throw new Error(`Unknown skin ${options.skinId}`);
    }
    if (
        options.chapterId
        && !loaded.manifest.chapters.some(chapter => chapter.id === options.chapterId)
    ) {
        throw new Error(`Unknown chapter ${options.chapterId} in ${options.packId}`);
    }

    let levelId = null;
    if (options.levelId !== null) {
        const level = loaded.resolved.levels.find(candidate => (
            candidate.packLevelId === options.levelId
            || String(candidate.id) === options.levelId
            || candidate.order === Number(options.levelId)
        ));
        if (!level) {
            throw new Error(`Unknown level ${options.levelId} in ${options.packId}`);
        }
        levelId = level.packLevelId || String(level.id);
    }

    const params = new URLSearchParams({ pack: loaded.manifest.id });
    if (levelId) {
        params.set('level', levelId);
        params.set('mode', options.mode);
    }
    if (options.skinId) params.set('skin', options.skinId);
    if (options.lab) params.set('lab', '1');
    if (options.chapterId) params.set('chapter', options.chapterId);
    if (options.page > 1) params.set('page', String(options.page));

    const url = `http://127.0.0.1:${options.port}/?${params.toString()}`;
    process.stdout.write(`Preview URL: ${url}\n`);
    if (options.printOnly) return 0;

    const child = spawn(
        process.execPath,
        [path.join(root, 'scripts/serve-static.js'), String(options.port)],
        { cwd: root, stdio: 'inherit' }
    );
    const stop = signal => {
        if (!child.killed) child.kill(signal);
    };
    process.once('SIGINT', () => stop('SIGINT'));
    process.once('SIGTERM', () => stop('SIGTERM'));
    child.once('exit', code => {
        process.exitCode = code ?? 0;
    });
    return null;
}

function parseArguments(argv) {
    const options = {
        packId: null,
        levelId: null,
        mode: 'test',
        skinId: null,
        lab: false,
        chapterId: null,
        page: 1,
        pageProvided: false,
        port: 4173,
        root: null,
        printOnly: false,
        help: false
    };

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === '--help' || argument === '-h') options.help = true;
        else if (argument === '--lab') options.lab = true;
        else if (argument === '--print-only') options.printOnly = true;
        else if (['--pack', '--level', '--mode', '--skin', '--chapter', '--page', '--port', '--root'].includes(argument)) {
            const value = requireValue(argv, ++index, argument);
            if (argument === '--pack') options.packId = value;
            else if (argument === '--level') options.levelId = value;
            else if (argument === '--mode') options.mode = value;
            else if (argument === '--skin') options.skinId = value;
            else if (argument === '--chapter') options.chapterId = value;
            else if (argument === '--root') options.root = value;
            else if (argument === '--page') {
                options.page = positiveInteger(value, '--page');
                options.pageProvided = true;
            }
            else if (argument === '--port') options.port = positiveInteger(value, '--port');
        } else {
            throw new Error(`Unknown option ${argument}`);
        }
    }
    return options;
}

function requireValue(argv, index, option) {
    if (index >= argv.length) throw new Error(`${option} requires a value`);
    return argv[index];
}

function positiveInteger(value, option) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${option} must be a positive integer`);
    }
    return parsed;
}

function usage() {
    return `Usage:
  npm run preview:pack -- --pack <pack-id> [--level <id|order>] [--mode test]
      [--skin <skin-id>] [--lab] [--chapter <chapter-id>] [--page 1]
      [--port 4173] [--print-only]

Examples:
  npm run preview:pack -- --pack balanced-v2 --level 10 --skin gilded-jewel-box
  npm run preview:pack -- --pack balanced-v2 --lab --chapter chapter-3
  npm run preview:pack -- --pack legacy --print-only
`;
}

try {
    const result = main(process.argv.slice(2));
    if (typeof result === 'number') process.exitCode = result;
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
