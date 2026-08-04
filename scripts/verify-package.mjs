import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const npmCli = process.env.npm_execpath;

if (!npmCli) {
    throw new Error('npm_execpath is unavailable. Run this verifier through npm.');
}

async function runNode(args, cwd) {
    try {
        return await execFileAsync(process.execPath, args, {
            cwd,
            env: { ...process.env, NO_COLOR: '1' },
            maxBuffer: 10 * 1024 * 1024,
        });
    } catch (error) {
        if (error && typeof error === 'object') {
            process.stderr.write(error.stdout ?? '');
            process.stderr.write(error.stderr ?? '');
        }

        throw error;
    }
}

function assertTarballContents(files) {
    const rootFiles = new Set([
        'CHANGELOG.md',
        'LICENSE',
        'README.md',
        'SECURITY.md',
        'package.json',
    ]);
    const forbiddenSegments = new Set([
        '.codex',
        '.git',
        '.playwright-mcp',
        '.serena',
        'coverage',
        'node_modules',
        'scripts',
        'src',
        'tests',
    ]);

    for (const file of files) {
        const normalized = file.path.replaceAll('\\', '/');
        const segments = normalized.split('/');

        if (segments.some((segment) => forbiddenSegments.has(segment))) {
            throw new Error(
                `Forbidden development file entered the tarball: ${normalized}`,
            );
        }

        if (
            !rootFiles.has(normalized) &&
            !normalized.startsWith('dist/') &&
            !normalized.startsWith('docs/')
        ) {
            throw new Error(`Unexpected file entered the tarball: ${normalized}`);
        }
    }

    for (const expected of [
        'dist/index.d.cts',
        'dist/index.d.ts',
        'dist/laravel-turnstile-vue.js',
        'dist/laravel-turnstile-vue.umd.cjs',
        'docs/laravel-inertia.md',
        'LICENSE',
        'README.md',
    ]) {
        if (!files.some((file) => file.path.replaceAll('\\', '/') === expected)) {
            throw new Error(`Required publish file is missing: ${expected}`);
        }
    }
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'turnstile-package-'));

try {
    const packed = await runNode(
        [
            npmCli,
            'pack',
            '.',
            '--json',
            '--ignore-scripts',
            '--pack-destination',
            temporaryRoot,
        ],
        root,
    );
    const packResult = JSON.parse(packed.stdout)[0];
    assertTarballContents(packResult.files);

    const consumer = join(temporaryRoot, 'consumer');
    await mkdir(consumer);
    const tarballPath = join(temporaryRoot, packResult.filename);
    const tarballSpec = `file:${relative(consumer, tarballPath).split(sep).join('/')}`;

    await writeFile(
        join(consumer, 'package.json'),
        `${JSON.stringify(
            {
                private: true,
                type: 'module',
                dependencies: {
                    [packageJson.name]: tarballSpec,
                    '@vue/server-renderer':
                        packageJson.devDependencies['@vue/server-renderer'],
                    typescript: packageJson.devDependencies.typescript,
                    vite: packageJson.devDependencies.vite,
                    vue: packageJson.devDependencies.vue,
                },
            },
            null,
            2,
        )}\n`,
    );

    await runNode(
        [npmCli, 'install', '--ignore-scripts', '--no-audit', '--no-fund'],
        consumer,
    );

    await writeFile(
        join(consumer, 'server.mjs'),
        `import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import TurnstileWidget, { TURNSTILE_TEST_SITEKEYS } from '${packageJson.name}';

const app = createSSRApp({
  render: () => h(TurnstileWidget, {
    sitekey: TURNSTILE_TEST_SITEKEYS.visibleAlwaysPasses,
  }),
});
const html = await renderToString(app);
if (!html.includes('data-turnstile-state="idle"')) {
  throw new Error(\`Unexpected ESM SSR output: \${html}\`);
}
console.log('esm-ssr-ok');
`,
    );

    await writeFile(
        join(consumer, 'server.cjs'),
        `const { createSSRApp, h } = require('vue');
const { renderToString } = require('@vue/server-renderer');
const turnstile = require('${packageJson.name}');

const app = createSSRApp({
  render: () => h(turnstile.default, {
    sitekey: turnstile.TURNSTILE_TEST_SITEKEYS.visibleAlwaysPasses,
  }),
});
renderToString(app).then((html) => {
  if (!html.includes('data-turnstile-state="idle"')) {
    throw new Error(\`Unexpected CJS SSR output: \${html}\`);
  }
  console.log('cjs-ssr-ok');
});
`,
    );

    await writeFile(
        join(consumer, 'types-esm.ts'),
        `import TurnstileWidget, {
  TURNSTILE_TEST_SITEKEYS,
  type TurnstileErrorKind,
  type TurnstileWidgetComponentProps,
  type TurnstileWidgetInstance,
  type TurnstileWidgetProps,
} from '${packageJson.name}';

const props = {
  sitekey: TURNSTILE_TEST_SITEKEYS.invisibleAlwaysPasses,
  execution: 'execute',
  appearance: 'execute',
} satisfies TurnstileWidgetProps;
const component: typeof TurnstileWidget = TurnstileWidget;
declare const instance: TurnstileWidgetInstance;
declare const publicInstance: InstanceType<typeof TurnstileWidget>;
const listenerProps = {
  sitekey: 'test-key',
  onSuccess: (token: string) => token.toUpperCase(),
} satisfies TurnstileWidgetComponentProps;
const errorKind: TurnstileErrorKind = 'preflight';
void component;
void props;
void listenerProps;
void errorKind;
void instance.challenge({ force: true, timeoutMs: 1000 });
void publicInstance.challenge({ force: true });
`,
    );

    await writeFile(
        join(consumer, 'types-cjs.cts'),
        `import TurnstileWidget, {
  type TurnstileWidgetProps,
} from '${packageJson.name}';

const props: TurnstileWidgetProps = { sitekey: 'test-key' };
const component: typeof TurnstileWidget = TurnstileWidget;
void props;
void component;
`,
    );

    await writeFile(
        join(consumer, 'tsconfig.json'),
        `${JSON.stringify(
            {
                compilerOptions: {
                    target: 'ES2022',
                    module: 'NodeNext',
                    moduleResolution: 'NodeNext',
                    strict: true,
                    noEmit: true,
                    skipLibCheck: false,
                    esModuleInterop: true,
                    lib: ['ES2022', 'DOM'],
                },
                include: ['types-esm.ts', 'types-cjs.cts'],
            },
            null,
            2,
        )}\n`,
    );

    await writeFile(
        join(consumer, 'entry-vite.mjs'),
        `import { createSSRApp, h } from 'vue';
import { renderToString } from '@vue/server-renderer';
import TurnstileWidget from '${packageJson.name}';

const html = await renderToString(createSSRApp({
  render: () => h(TurnstileWidget, { sitekey: 'test-key' }),
}));
if (!html.includes('data-turnstile-state="idle"')) {
  throw new Error(\`Unexpected Vite SSR output: \${html}\`);
}
console.log('vite-ssr-ok');
`,
    );

    for (const [name, ssr] of [
        ['external', {}],
        ['bundled', { noExternal: [packageJson.name] }],
    ]) {
        await writeFile(
            join(consumer, `vite.${name}.config.mjs`),
            `import { defineConfig } from 'vite';

export default defineConfig({
  ssr: ${JSON.stringify(ssr)},
  build: {
    ssr: './entry-vite.mjs',
    outDir: './dist-${name}',
    emptyOutDir: true,
  },
});
`,
        );
    }

    const typescriptBin = join(consumer, 'node_modules', 'typescript', 'bin', 'tsc');
    const viteBin = join(consumer, 'node_modules', 'vite', 'bin', 'vite.js');
    await runNode(['server.mjs'], consumer);
    await runNode(['server.cjs'], consumer);
    await runNode([typescriptBin, '--project', 'tsconfig.json'], consumer);

    for (const name of ['external', 'bundled']) {
        await runNode(
            [viteBin, 'build', '--config', `vite.${name}.config.mjs`],
            consumer,
        );
        await runNode([join(consumer, `dist-${name}`, 'entry-vite.js')], consumer);
    }

    await runNode(
        [
            npmCli,
            'install',
            '--no-save',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            'vue@3.2.47',
            '@vue/server-renderer@3.2.47',
        ],
        consumer,
    );
    await writeFile(
        join(consumer, 'peer-version.mjs'),
        `import { version } from 'vue';
if (version !== '3.2.47') {
  throw new Error(\`Expected Vue 3.2.47, received \${version}.\`);
}
console.log('minimum-peer-ok');
`,
    );
    await runNode(['peer-version.mjs'], consumer);
    await runNode(['server.mjs'], consumer);
    await runNode(['server.cjs'], consumer);
    await runNode([typescriptBin, '--project', 'tsconfig.json'], consumer);

    process.stdout.write(
        `Packed consumer verified (${packResult.files.length} published files; ESM, CJS, types, two Vite SSR modes, and Vue 3.2).\n`,
    );
} finally {
    await rm(temporaryRoot, { recursive: true, force: true });
}
