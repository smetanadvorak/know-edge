// usage:
//   npm run dev:obsidian    (repo root) -> watch mode, writes main.js + manifest.json + styles.css into test-vault/.obsidian/plugins/know-edge
//   npm run build:obsidian  (repo root) -> production build, writes main.js + styles.css in packages/obsidian
import esbuild from 'esbuild';
import esbuild_svelte from 'esbuild-svelte';
import { builtinModules } from 'node:module';
import { copyFileSync, mkdirSync, watch } from 'node:fs';

const prod = process.argv[2] === 'production';
const dev_dir = '../../test-vault/.obsidian/plugins/know-edge';

// source path -> file name in the plugin folder
const static_files = { 'manifest.json': 'manifest.json', '../ui/styles.css': 'styles.css' };

function copyStatic(dir) {
  mkdirSync(dir, { recursive: true });
  for (const [src, name] of Object.entries(static_files)) copyFileSync(src, `${dir}/${name}`);
}

// copy static plugin files next to the dev build
const copy_static = {
  name: 'copy-static',
  setup(build) {
    build.onEnd(() => {
      if (prod) copyFileSync('../ui/styles.css', 'styles.css');
      else copyStatic(dev_dir);
    });
  },
};

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*', ...builtinModules],
  format: 'cjs',
  target: 'es2020',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  minify: prod,
  outfile: prod ? 'main.js' : `${dev_dir}/main.js`,
  mainFields: ['svelte', 'browser', 'module', 'main'],
  conditions: ['svelte', 'browser'],
  plugins: [esbuild_svelte({ compilerOptions: { css: 'injected' } }), copy_static],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
  // static files are not part of the bundle, so watch them separately
  for (const src of Object.keys(static_files)) {
    watch(src, () => {
      copyStatic(dev_dir);
      console.log(`copied ${src}`);
    });
  }
}
