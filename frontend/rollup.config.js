import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import sveltePreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';
import css from 'rollup-plugin-css-only';
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';
import {
    less
} from 'svelte-preprocess-less';
import terser from "@rollup/plugin-terser";

const production = !process.env.ROLLUP_WATCH;
const livereloadEnabled = process.env.NO_LIVERELOAD !== '1';

function isIgnoredWarning(warning) {
    const ids = Array.isArray(warning?.ids) ? warning.ids : [];
    const id = warning?.id || warning?.loc?.file || "";
    const message = warning?.message || "";

    const isNodeModulesCircular =
        warning?.code === "CIRCULAR_DEPENDENCY" &&
        ids.length > 0 &&
        ids.every((x) => x.includes("node_modules/"));

    const isThirdPartySvelteWarning =
        warning?.plugin === "svelte" &&
        (id.includes("node_modules/svelte-loading-spinners") ||
            id.includes("node_modules/svelte-select") ||
            message.includes("node_modules/svelte-loading-spinners") ||
            message.includes("node_modules/svelte-select"));

    return isNodeModulesCircular || isThirdPartySvelteWarning;
}

function serve() {
    let server;

    function toExit() {
        if (server) server.kill(0);
    }

    return {
        writeBundle() {
            if (server) return;
            server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
                stdio: ['ignore', 'inherit', 'inherit'],
                shell: true
            });

            process.on('SIGTERM', toExit);
            process.on('exit', toExit);
        }
    };
}

export default {
    input: 'src/main.ts',
    onwarn(warning, defaultHandler) {
        if (isIgnoredWarning(warning)) return;
        defaultHandler(warning);
    },
    output: {
        sourcemap: !production,
        format: 'iife',
        name: 'app',
        file: 'public/build/bundle.js'
    },
    plugins: [
        replace({
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
            STEMMA_BACKEND_URL: process.env.STEMMA_BACKEND_URL,
            E2E_AUTO_LOGIN: JSON.stringify(process.env.E2E_AUTO_LOGIN || "0"),
            preventAssignment: true,
        }),
        svelte({
            preprocess: sveltePreprocess({
                sourceMap: !production,
                style: less(),
            }),
            compilerOptions: {
                dev: !production,
                runes: false
            }
        }),
        css({
            output: 'bundle.css'
        }),

        copy({
            targets: [{
                    src: "node_modules/bootstrap/dist/css/bootstrap.min.css",
                    dest: "public/vendor/bootstrap/css",
                },
                {
                    src: "node_modules/bootstrap/dist/css/bootstrap.min.css.map",
                    dest: "public/vendor/bootstrap/css",
                },
                {
                    src: "node_modules/bootstrap-icons/font/bootstrap-icons.css",
                    dest: "public/vendor/bootstrap-icons/font",
                },
                {
                    src: "node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2",
                    dest: "public/vendor/bootstrap-icons/font/fonts",
                }
            ]
        }),

        resolve({
            browser: true,
            dedupe: ['svelte'],
            exportConditions: ['svelte']
        }),
        commonjs(),
        typescript({
            sourceMap: !production,
            inlineSources: !production
        }),

        // In dev mode, call `npm run start` once
        // the bundle has been generated
        !production && serve(),

        // Watch the `public` directory and refresh the
        // browser on changes when not in production
        !production && livereloadEnabled && livereload('public'),

        // If we're building for production (npm run build
        // instead of npm run dev), minify
        production && terser({ maxWorkers: 1 })
    ],
    watch: {
        clearScreen: false
    }
};
