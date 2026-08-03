#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    evaluateCampaign,
    loadCampaign,
    planCampaign,
    renderCampaignHtml
} = require('./lib/playtest-campaign');

function main(argv) {
    const parsed = parseArguments(argv);
    if (parsed.help || !parsed.command || !parsed.campaignPath) {
        process.stdout.write(usage());
        return parsed.help ? 0 : 2;
    }

    const root = path.resolve(parsed.root || process.cwd());
    const loaded = loadCampaign(root, parsed.campaignPath);
    const plan = planCampaign(loaded, {
        baseURL: parsed.baseURL,
        skinId: parsed.skinId
    });
    const sources = loadSources(parsed.inputs);
    let output;

    if (parsed.command === 'plan') {
        output = plan;
    } else if (parsed.command === 'status') {
        output = evaluateCampaign(loaded, sources);
    } else if (parsed.command === 'next') {
        const status = evaluateCampaign(loaded, sources);
        const next = status.nextAnchor
            ? plan.anchors.find(anchor => anchor.levelId === status.nextAnchor.levelId)
            : null;
        output = {
            schema: 'needles.playtest-campaign-next/v1',
            campaignId: loaded.campaign.id,
            complete: status.complete,
            next: next
                ? {
                    ...status.nextAnchor,
                    previewURL: next.previewURL,
                    comparison: next.comparison
                }
                : null
        };
    } else {
        throw new Error(`Unknown campaign command ${parsed.command}`);
    }

    const json = `${JSON.stringify(output, null, 2)}\n`;
    if (parsed.jsonPath) writeFile(parsed.jsonPath, json);
    if (parsed.htmlPath) {
        const status = parsed.command === 'plan'
            ? null
            : evaluateCampaign(loaded, sources);
        writeFile(parsed.htmlPath, renderCampaignHtml(plan, status));
    }

    if (!parsed.jsonPath && !parsed.htmlPath) {
        process.stdout.write(json);
    } else {
        if (parsed.jsonPath) {
            process.stdout.write(`JSON: ${path.resolve(parsed.jsonPath)}\n`);
        }
        if (parsed.htmlPath) {
            process.stdout.write(`HTML: ${path.resolve(parsed.htmlPath)}\n`);
        }
    }
    return 0;
}

function parseArguments(argv) {
    const parsed = {
        command: null,
        campaignPath: null,
        inputs: [],
        root: null,
        baseURL: null,
        skinId: null,
        jsonPath: null,
        htmlPath: null,
        help: false
    };

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === '--help' || argument === '-h') parsed.help = true;
        else if (['--root', '--base-url', '--skin', '--json', '--html'].includes(argument)) {
            const value = requireValue(argv, ++index, argument);
            if (argument === '--root') parsed.root = value;
            else if (argument === '--base-url') parsed.baseURL = value;
            else if (argument === '--skin') parsed.skinId = value;
            else if (argument === '--json') parsed.jsonPath = value;
            else if (argument === '--html') parsed.htmlPath = value;
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option ${argument}`);
        } else if (!parsed.command) {
            parsed.command = argument;
        } else if (!parsed.campaignPath) {
            parsed.campaignPath = argument;
        } else {
            parsed.inputs.push(argument);
        }
    }
    return parsed;
}

function loadSources(inputs) {
    return expandInputs(inputs).map(filePath => ({
        source: path.basename(filePath),
        bundle: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    }));
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
    return `Needles playtest campaign CLI

Usage:
  npm run campaign -- plan <campaign.json> [--base-url http://127.0.0.1:4173/]
      [--skin clockwork-observatory] [--json plan.json] [--html plan.html]
  npm run campaign -- status <campaign.json> [export.json|directory ...]
      [--json status.json] [--html status.html]
  npm run campaign -- next <campaign.json> [export.json|directory ...]

Examples:
  npm run campaign -- plan playtests/campaigns/balanced-v2-anchor-v1.json --html reports/anchors.html
  npm run campaign -- status playtests/campaigns/balanced-v2-anchor-v1.json downloads/
  npm run campaign -- next playtests/campaigns/balanced-v2-anchor-v1.json downloads/
`;
}

try {
    process.exitCode = main(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
