#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    buildBalanceReview,
    renderBalanceReviewHtml
} = require('./lib/balance-review');

function main(argv) {
    const parsed = parseArguments(argv);
    if (parsed.help || !parsed.campaignPath) {
        process.stdout.write(usage());
        return parsed.help ? 0 : 2;
    }

    const root = path.resolve(parsed.root || process.cwd());
    const sources = expandInputs(parsed.inputs).map(filePath => ({
        source: path.basename(filePath),
        bundle: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    }));
    const review = buildBalanceReview(
        root,
        parsed.campaignPath,
        sources,
        {
            minSamples: parsed.minSamples,
            baseURL: parsed.baseURL,
            skinId: parsed.skinId
        }
    );
    const json = `${JSON.stringify(review, null, 2)}\n`;

    if (parsed.jsonPath) writeFile(parsed.jsonPath, json);
    if (parsed.htmlPath) {
        writeFile(parsed.htmlPath, renderBalanceReviewHtml(review));
    }
    if (!parsed.jsonPath && !parsed.htmlPath) {
        process.stdout.write(json);
    } else {
        if (parsed.jsonPath) process.stdout.write(`JSON: ${path.resolve(parsed.jsonPath)}\n`);
        if (parsed.htmlPath) process.stdout.write(`HTML: ${path.resolve(parsed.htmlPath)}\n`);
    }
    return 0;
}

function parseArguments(argv) {
    const parsed = {
        campaignPath: null,
        inputs: [],
        root: null,
        jsonPath: null,
        htmlPath: null,
        minSamples: null,
        baseURL: null,
        skinId: null,
        help: false
    };

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === '--help' || argument === '-h') parsed.help = true;
        else if (['--root', '--json', '--html', '--min-samples', '--base-url', '--skin'].includes(argument)) {
            const value = requireValue(argv, ++index, argument);
            if (argument === '--root') parsed.root = value;
            else if (argument === '--json') parsed.jsonPath = value;
            else if (argument === '--html') parsed.htmlPath = value;
            else if (argument === '--base-url') parsed.baseURL = value;
            else if (argument === '--skin') parsed.skinId = value;
            else {
                const number = Number(value);
                if (!Number.isInteger(number) || number <= 0) {
                    throw new Error('--min-samples must be a positive integer');
                }
                parsed.minSamples = number;
            }
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option ${argument}`);
        } else if (!parsed.campaignPath) {
            parsed.campaignPath = argument;
        } else {
            parsed.inputs.push(argument);
        }
    }
    return parsed;
}

function expandInputs(inputs) {
    const files = [];
    inputs.forEach(input => {
        const absolute = path.resolve(input);
        const stats = fs.statSync(absolute);
        if (stats.isDirectory()) {
            fs.readdirSync(absolute)
                .filter(name => name.toLowerCase().endsWith('.json'))
                .sort()
                .forEach(name => files.push(path.join(absolute, name)));
        } else {
            files.push(absolute);
        }
    });
    return [...new Set(files)];
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
    return `Usage:
  npm run review:balance -- <campaign.json> [export.json|directory ...]
      [--json review.json] [--html review.html]
      [--min-samples 5] [--base-url http://127.0.0.1:4173/]

Example:
  npm run review:balance -- \
    playtests/campaigns/balanced-v2-anchor-v1.json \
    downloads/ \
    --json reports/balance-review.json \
    --html reports/balance-review.html
`;
}

try {
    process.exitCode = main(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
