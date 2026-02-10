const sveltePreprocess = require("svelte-preprocess");
const { less } = require("svelte-preprocess-less");

module.exports = {
    preprocess: sveltePreprocess({
        style: less(),
    }),
    compilerOptions: {
        runes: false,
    },
};
