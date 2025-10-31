import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, extname, relative } from 'node:path';
import {
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
  existsSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const tsconfigPath = join(projectRoot, 'tsconfig.json');
const rawConfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));
const tempConfig = JSON.parse(JSON.stringify(rawConfig));

if (tempConfig.compilerOptions) {
  delete tempConfig.compilerOptions.preserveShebangs;
}

const tempConfigPath = join(projectRoot, 'tsconfig.build.tmp.json');
writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));

const tscPath = require.resolve('typescript/lib/tsc.js');
const buildResult = spawnSync(process.execPath, [tscPath, '-p', tempConfigPath], {
  stdio: 'inherit',
});

if (buildResult.status !== 0) {
  rmSync(tempConfigPath, { force: true });
  process.exit(buildResult.status ?? 1);
}

const outDir = rawConfig.compilerOptions?.outDir ?? 'build';
const sourceRoot = rawConfig.compilerOptions?.rootDir
  ? join(projectRoot, rawConfig.compilerOptions.rootDir)
  : projectRoot;
const buildRoot = join(projectRoot, outDir);

const shebangMap = new Map();

function recordShebangs(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      recordShebangs(entryPath);
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (!['.ts', '.mts', '.cts', '.tsx'].includes(extension)) {
      continue;
    }

    const content = readFileSync(entryPath, 'utf8');
    if (!content.startsWith('#!')) {
      continue;
    }

    const firstLineEnd = content.indexOf('\n');
    const shebangLine = firstLineEnd === -1 ? content : content.slice(0, firstLineEnd);
    const relativePath = relative(sourceRoot, entryPath);
    const outputFile = convertToJsExtension(relativePath);
    shebangMap.set(outputFile, shebangLine);
  }
}

function convertToJsExtension(relativePath) {
  if (relativePath.endsWith('.mts')) {
    return relativePath.slice(0, -4) + '.mjs';
  }
  if (relativePath.endsWith('.cts')) {
    return relativePath.slice(0, -4) + '.cjs';
  }
  if (relativePath.endsWith('.tsx')) {
    return relativePath.slice(0, -4) + '.jsx';
  }
  if (relativePath.endsWith('.ts')) {
    return relativePath.slice(0, -3) + '.js';
  }
  return relativePath;
}

if (existsSync(sourceRoot)) {
  recordShebangs(sourceRoot);
}

for (const [relativeOutput, shebangLine] of shebangMap) {
  const outputPath = join(buildRoot, relativeOutput);
  if (!existsSync(outputPath) || !statSync(outputPath).isFile()) {
    continue;
  }

  const existingContent = readFileSync(outputPath, 'utf8');
  if (existingContent.startsWith(shebangLine)) {
    continue;
  }
  if (existingContent.startsWith('#!')) {
    const newlineIndex = existingContent.indexOf('\n');
    const remainingContent =
      newlineIndex === -1 ? '' : existingContent.slice(newlineIndex + 1);
    const contentToWrite = remainingContent
      ? `${shebangLine}\n${remainingContent}`
      : `${shebangLine}\n`;
    writeFileSync(outputPath, contentToWrite);
    continue;
  }

  writeFileSync(outputPath, `${shebangLine}\n${existingContent}`);
}

rmSync(tempConfigPath, { force: true });
