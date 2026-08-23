const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowDirectory = path.resolve(__dirname, '..', '.github', 'workflows');
const automaticTriggers = [
  'push',
  'pull_request',
  'pull_request_target',
  'schedule',
  'workflow_run',
  'deployment',
  'deployment_status',
  'repository_dispatch',
  'release'
];

test('every GitHub Actions workflow is manually triggered only', () => {
  const workflowFiles = fs.readdirSync(workflowDirectory)
    .filter(file => /\.ya?ml$/i.test(file))
    .sort();

  assert.ok(workflowFiles.length > 0, 'at least one workflow must exist');

  workflowFiles.forEach(file => {
    const source = fs.readFileSync(path.join(workflowDirectory, file), 'utf8');
    const uncommented = source
      .split('\n')
      .filter(line => !/^\s*#/.test(line))
      .join('\n');

    assert.match(
      uncommented,
      /^on:\s*\n(?:\s*\n)*\s{2}workflow_dispatch:/m,
      `${file} must declare workflow_dispatch under on`
    );

    automaticTriggers.forEach(trigger => {
      assert.doesNotMatch(
        uncommented,
        new RegExp(`^\\s{2}${trigger}:`, 'm'),
        `${file} must not declare automatic trigger ${trigger}`
      );
    });
  });
});

test('Tests workflow runs the frozen full validation gate', () => {
  const source = fs.readFileSync(
    path.join(workflowDirectory, 'tests.yml'),
    'utf8'
  );
  const packageJson = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '..', 'package.json'),
    'utf8'
  ));

  assert.equal(
    packageJson.scripts['test:all'],
    'npm test && npm run validate:packs && npm run test:e2e'
  );
  assert.match(source, /^\s*run: npm ci --no-audit --no-fund$/m);
  assert.match(source, /^\s*run: npx playwright install --with-deps chromium$/m);
  assert.match(source, /^\s*run: npm run test:all$/m);
  assert.doesNotMatch(source, /^\s*run: npm install(?:\s|$)/m);
});
