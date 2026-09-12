import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout ?? '';
}

function markdownPaths(extraArgs = []) {
  return run('git', ['ls-files', '-z', ...extraArgs, '--', '*.md'])
    .split('\0')
    .filter(Boolean)
    .sort();
}

async function markdownSnapshot() {
  const tracked = markdownPaths();
  const untracked = markdownPaths(['--others', '--exclude-standard']);
  const paths = [...new Set([...tracked, ...untracked])].sort();
  const hashes = new Map();

  for (const path of paths) {
    const content = await readFile(path);
    hashes.set(path, createHash('sha256').update(content).digest('hex'));
  }

  return hashes;
}

const before = await markdownSnapshot();

run('pnpm', ['exec', 'vortex', '--version', '--no-check'], { stdio: 'inherit' });
run('pnpm', ['run', 'vortex:generate:all'], { stdio: 'inherit' });

const after = await markdownSnapshot();
const allPaths = [...new Set([...before.keys(), ...after.keys()])].sort();
const changed = allPaths.filter((path) => before.get(path) !== after.get(path));

if (changed.length > 0) {
  console.error(`Generated Markdown drifted:\n${changed.map((path) => `  ${path}`).join('\n')}`);
  process.exit(1);
}
