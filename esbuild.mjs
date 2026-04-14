import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * esbuild bundles markdown-it-imsize's glob require with keys like './types/bmp.js',
 * but detector.js looks up './types/bmp' (no extension), causing a runtime error.
 * This plugin patches detector.js at build time to append '.js' to the dynamic path.
 * @type {import('esbuild').Plugin}
 */
const fixImsizeGlobPlugin = {
    name: 'fix-imsize-glob',
    setup(build) {
        const filter = /markdown-it-imsize[/\\]lib[/\\]imsize[/\\](detector|index)\.js$/;
        build.onLoad({ filter }, (args) => {
            let contents = fs.readFileSync(args.path, 'utf8');
            contents = contents.replace(
                /require\('\.\/types\/' \+ type\)/g,
                "require('./types/' + type + '.js')"
            );
            return { contents, loader: 'js' };
        });
    },
};

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    },
};

function copySync(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function tryOr(fn, label) {
    try {
        fn();
    } catch (e) {
        console.warn(`[warn] ${label}: ${e.message}`);
    }
}

function copyAssets() {
    // Themes
    tryOr(() => {
        const src = './node_modules/orz-markdown/themes';
        const dest = './out/themes';
        fs.mkdirSync(dest, { recursive: true });
        for (const file of fs.readdirSync(src)) {
            if (file.endsWith('.css')) {
                fs.copyFileSync(path.join(src, file), path.join(dest, file));
            }
        }
        console.log('Themes copied.');
    }, 'copy themes');

    // highlight.js (from @highlightjs/cdn-assets)
    tryOr(() => {
        const hlBase = './node_modules/@highlightjs/cdn-assets';
        copySync(`${hlBase}/highlight.min.js`, './out/vendor/highlight/highlight.min.js');
        copySync(`${hlBase}/styles/atom-one-dark.min.css`, './out/vendor/highlight/atom-one-dark.min.css');
        copySync(`${hlBase}/styles/github.min.css`, './out/vendor/highlight/github.min.css');
        console.log('highlight.js copied.');
    }, 'copy highlight.js');

    // KaTeX
    tryOr(() => {
        const katexBase = './node_modules/katex/dist';
        copySync(`${katexBase}/katex.min.css`, './out/vendor/katex/katex.min.css');
        copyDirSync(`${katexBase}/fonts`, './out/vendor/katex/fonts');
        console.log('KaTeX copied.');
    }, 'copy katex');

    // Mermaid
    tryOr(() => {
        copySync('./node_modules/mermaid/dist/mermaid.min.js', './out/vendor/mermaid/mermaid.min.js');
        console.log('Mermaid copied.');
    }, 'copy mermaid');

    // SmilesDrawer
    tryOr(() => {
        copySync('./node_modules/smiles-drawer/dist/smiles-drawer.min.js', './out/vendor/smiles-drawer/smiles-drawer.min.js');
        console.log('SmilesDrawer copied.');
    }, 'copy smiles-drawer');
}

async function main() {
    const ctx = await esbuild.context({
        entryPoints: [
            'src/extension.ts'
        ],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'out/extension.js',
        external: ['vscode'],
        logLevel: 'silent',
        plugins: [
            fixImsizeGlobPlugin,
            esbuildProblemMatcherPlugin,
        ],
    });
    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
    copyAssets();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
