#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    analyzePlaytests,
    renderHtmlReport
} = require('./lib/playtest-analysis');

function main(argv) {
    const options = parseArguments(argv);
    if (options.help || options.inputs.length === 0) {
        process.stdout.write(usage());
        return options.help ? 0 : 2;
    }

    const inputFiles = expandInputs(options.inputs);
    if (inputFiles.length === 0) {
        throw new Error('No JSON input files were found');
    }
    const sources = inputFiles.map(filePath => ({
        source: path.basename(filePath),
        bundle: JSON.parse(fs.readFileSync(filePath, 'utf8'))
    }));
    const report = analyzePlaytests(sources, {
        minSamples: options.minSamples
    });
    const json = `${JSON.stringify(report, null, 2)}\n`;

    if (options.jsonPath) writeFile(options.jsonPath, json);
    if (options.htmlPath) {
        writeFile(options.htmlPath, renderHtmlReport(report));
    }
    if (!options.jsonPath && !options.htmlPath) {
        process.stdout.write(json);
    } else {
        process.stdout.write(
            `Analyzed ${report.attemptCount} attempts from ${report.sourceCount} source(s).\n`
                + `${options.jsonPath ? `JSON: ${path.resolve(options.jsonPath)}\n` : ''}`
                + `${options.htmlPath ? `HTML: ${path.resolve(options.htmlPath)}\n` : ''}`
        );
    }
    return 0;
}

function parseArguments(argv) {
    const result = {
        inputs: [],
        jsonPath: null,
        htmlPath: null,
        minSamples: 5,
        help: false
    };

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === '--help' || argument === '-h') {
            result.help = true;
        } else if (argument === '--json') {
            result.jsonPath = requireValue(argv, ++index, '--json');
        } else if (argument === '--html') {
            result.htmlPath = requireValue(argv, ++index, '--html');
        } else if (argument === '--min-samples') {
            const value = Number(requireValue(argv, ++index, '--min-samples'));
            if (!Number.isInteger(value) || value <= 0) {
                throw new Error('--min-samples must be a positive integer');
            }
            result.minSamples = value;
        } else if (argument.startsWith('-')) {
            throw new Error(`Unknown option ${argument}`);
        } else {
            result.inputs.push(argument);
        }
    }
    return result;
}

function requireValue(argv, index, option) {
    if (index >= argv.length) throw new Error(`${option} requires a value`);
    return argv[index];
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

function writeFile(filePath, content) {
    const absolute = path.resolve(filePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, 'utf8');
}

function usage() {
    return `Usage:
  node scripts/analyze-playtests.js <export.json|directory> [...inputs]
      [--json report.json] [--html report.html] [--min-samples 5]

Examples:
  node scripts/analyze-playtests.js downloads/ --json reports/data.json --html reports/index.html
  node scripts/analyze-playtests.js playtests-a.json playtests-b.json
`;
}

try {
    process.exitCode = main(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
