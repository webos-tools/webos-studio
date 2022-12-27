module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "jquery": true,
        "node": true,
        "mocha": true
    },
    "extends": [
        "eslint:recommended"
    ],
    "plugins": [
        "import"
    ],
    "parser" : "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": 2018,
        "ecmaFeatures": {
            "jsx": true
        },
        "sourceType": "module"
    },
    "rules": {
        "no-const-assign": "warn",
        "no-this-before-super": "warn",
        "no-undef": "warn",
        "no-unreachable": "warn",
        "no-unused-vars": "warn",
        "constructor-super": "warn",
        "valid-typeof": "warn"
    },
    "globals": {
        "acquireVsCodeApi" : false,
        "UIDGenerator" : false
    }
}
