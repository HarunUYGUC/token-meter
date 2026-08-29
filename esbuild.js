const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/**
 * Ensure dist directory exists
 */
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Common build options for Extension Host (Node.js)
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
};

// Common build options for Test Suite
const testConfig = {
  entryPoints: ['test/tokenizer.test.ts'],
  bundle: true,
  outfile: 'dist/test/tokenizer.test.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: !isProduction,
  logLevel: 'info',
};

// Common build options for Webview UI (Browser)
const webviewConfig = {
  entryPoints: ['src/webview/main.ts'],
  bundle: true,
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: !isProduction,
  minify: isProduction,
  logLevel: 'info',
};

async function build() {
  try {
    // Copy style.css to dist
    if (fs.existsSync('src/webview/style.css')) {
      fs.copyFileSync('src/webview/style.css', 'dist/style.css');
    }

    if (isWatch) {
      const extCtx = await esbuild.context(extensionConfig);
      const webCtx = await esbuild.context(webviewConfig);
      await Promise.all([extCtx.watch(), webCtx.watch()]);
      console.log('⚡ Watching for changes...');
    } else {
      await Promise.all([
        esbuild.build(extensionConfig),
        esbuild.build(testConfig),
        esbuild.build(webviewConfig)
      ]);
      console.log('✅ Build completed successfully.');
    }
  } catch (err) {
    console.error('❌ Build failed:', err);
    process.exit(1);
  }
}

build();
