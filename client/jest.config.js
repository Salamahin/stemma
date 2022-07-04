module.exports = {
    "roots": [
        "<rootDir>/src"
    ],
    "testMatch": [
        "**/__tests__/**/*.+(ts|tsx|js)",
        "**/?(*.)+(spec|test).+(ts|tsx|js)"
    ],
    "transform": {
        "^.+\\.(ts|tsx)$": "ts-jest",
        '^.+\\.svelte$': ['svelte-jester', {
            preprocess: true,
        }]
    },
    moduleFileExtensions: ['js', 'ts', 'svelte'],
    "testEnvironment": "jsdom"
}