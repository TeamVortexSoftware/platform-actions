import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

const expectedGate =
  'node --test test/dependabot-contract.test.mjs && node bin/test-dependabot.mjs';

test('test:dependabot keeps the repository-owned verification contract', () => {
  assert.equal(packageJson.scripts['test:dependabot'], expectedGate);
  assert.equal(packageJson.scripts['vortex:generate:all'], 'vortex markdown update .');
});

test('the vortex CLI comes from PATH, never from node_modules', async () => {
  // The platform repos deliberately carry no config-utility dependency: a copy
  // in node_modules shadows the real `vortex` on PATH. The gate therefore runs
  // whatever `vortex` the environment provides, exactly as a developer does.
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  assert.equal(deps['@teamvortexsoftware/config-utility'], undefined);
});
