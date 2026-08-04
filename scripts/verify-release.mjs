import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const expectedTag = `v${packageJson.version}`;
const releaseTag = process.env.RELEASE_TAG;

if (releaseTag !== expectedTag) {
    throw new Error(
        `Release tag ${JSON.stringify(releaseTag)} does not match package version ${JSON.stringify(expectedTag)}.`,
    );
}

if (packageJson.version.includes('-')) {
    throw new Error('Stable publishing does not accept a prerelease package version.');
}

process.stdout.write(`Release tag ${releaseTag} matches ${packageJson.name}.\n`);
