#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { validatePackRepository } = require('./lib/pack-schema-validation');

try {
    const root = path.resolve(process.argv[2] || process.cwd());
    const result = validatePackRepository(root);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
