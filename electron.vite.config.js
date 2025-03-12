const { defineConfig } = require('electron-vite');

module.exports = defineConfig({
    main: {
        build: {
            sourcemap: true,
            outDir: 'out/main',
        }
    },
    preload: {
        build: {
            sourcemap: true,
            outDir: 'out/preload',
        }
    },
    renderer: {
        build: {
            sourcemap: true,
            outDir: 'out/renderer',
        }
    }
});