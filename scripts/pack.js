#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validatePackRepository } = require('./lib/pack-schema-validation');
const {
    auditPack,
    createPackReport,
    createStarterPack,
    diffPacks,
    renderPackReportHtml,
    scorePack
} = require('./lib/pack-toolkit');

function main(argv) {
    const parsed = parseArguments(argv);
    if (parsed.help || !parsed.command) {
        process.stdout.write(usage());
        return parsed.help ? 0 : 2;
    }
    const root = path.resolve(parsed.options.root || process.cwd());
    let result;

    if (parsed.command === 'validate') {
        requireArgumentCount(parsed, 0);
        result = validatePackRepository(root);
    } else if (parsed.command === 'audit') {
        requireArgumentCount(parsed, 1);
        result = auditPack(root, parsed.arguments[0]);
    } else if (parsed.command === 'score') {
        requireArgumentCount(parsed, 1);
        result = scorePack(root, parsed.arguments[0]);
    } else if (parsed.command === 'report') {
        requireArgumentCount(parsed, 1);
        result = createPackReport(root, parsed.arguments[0]);
        if (parsed.options.html) {
            writeFile(parsed.options.html, renderPackReportHtml(result));
        }
    } else if (parsed.command === 'diff') {
        requireArgumentCount(parsed, 2);
        result = diffPacks(root, parsed.arguments[0], parsed.arguments[1]);
    } else if (parsed.command === 'create') {
        requireArgumentCount(parsed, 1);
        result = createStarterPack(root, parsed.arguments[0], {
            title: parsed.options.title,
            caption: parsed.options.caption,
            difficultyModel: parsed.options.difficultyModel,
            register: parsed.options.register
        });
    } else {
        throw new Error(`Unknown command ${parsed.command}`);
    }

    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (parsed.options.json) {
        writeFile(parsed.options.json, json);
        process.stdout.write(`JSON: ${path.resolve(parsed.options.json)}\n`);
        if (parsed.options.html) {
            process.stdout.write(`HTML: ${path.resolve(parsed.options.html)}\n`);
        }
    } else {
        process.stdout.write(json);
    }
    return 0;
}

function parseArguments(argv) {
    const result = {
        command: null,
        arguments: [],
        help: false,
        options: {
            root: null,
            json: null,
            html: null,
            title: null,
            caption: null,
            difficultyModel: null,
            register: false
        }
    };

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === '--help' || argument === '-h') {
            result.help = true;
        } else if (argument === '--register') {
            result.options.register = true;
        } else if ([
            '--root',
            '--json',
            '--html',
            '--title',
            '--caption',
            '--difficulty-model'
        ].includes(argument)) {
            const key = argument === '--difficulty-model'
                ? 'difficultyModel'
                : argument.slice(2);
            result.options[key] = requireValue(argv, ++index, argument);
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option ${argument}`);
        } else if (!result.command) {
            result.command = argument;
        } else {
            result.arguments.push(argument);
        }
    }
    return result;
}

function requireArgumentCount(parsed, count) {
    if (parsed.arguments.length !== count) {
        throw new Error(
            `${parsed.command} requires ${count} positional argument(s), got ${parsed.arguments.length}`
        );
    }
}

function requireValue(argv, index, option) {
    if (index >= argv.length) throw new Error(`${option} requires a value`);
    return argv[index];
}

function writeFile(filePath, content) {
    const absolute = path.resolve(filePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
}

function usage() {
    return `Needles level-pack CLI

Usage:
  npm run pack -- validate [--root .]
  npm run pack -- audit <pack-id> [--json audit.json]
  npm run pack -- score <pack-id> [--json scores.json]
  npm run pack -- report <pack-id> [--json report.json] [--html report.html]
  npm run pack -- diff <left-pack-id|directory> <right-pack-id|directory> [--json diff.json]
  npm run pack -- create <pack-id> [--title title] [--caption text]
      [--difficulty-model nonlinear-v2] [--register]

Examples:
  npm run pack -- validate
  npm run pack -- audit balanced-v2
  npm run pack -- report balanced-v2 --html reports/balanced-v2.html
  npm run pack -- diff legacy balanced-v2
  npm run pack -- create tutorial-pack --title "教学包" --register
`;
}

try {
    process.exitCode = main(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
