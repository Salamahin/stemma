module.exports = {
    "roots": [
        "<rootDir>/src"
    ],
    "testMatch": [
        "**/__tests__/**/*.+(ts|tsx|js)",
        "**/?(*.)+(spec|test).+(ts|tsx|js)"
    ],
    "transform": {
        "^.+\\.(t|j)sx?$": [
            "@swc/jest",
            {
                "jsc": {
                    "parser": {
                        "syntax": "typescript",
                        "tsx": false
                    }
                },
                "module": {
                    "type": "commonjs"
                }
            }
        ]
    },
    "transformIgnorePatterns": [
        "/node_modules/(?!svelte)/"
    ],
    moduleFileExtensions: ['js', 'ts', 'svelte'],
    "testEnvironment": "jsdom"
}
