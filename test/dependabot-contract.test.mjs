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

test('the published config-utility dependency imports successfully', async () => {
  await assert.doesNotReject(import('@teamvortexsoftware/config-utility'));
});
