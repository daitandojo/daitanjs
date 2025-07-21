module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  extends: [
    "eslint:recommended",
    "plugin:node/recommended",
    "plugin:prettier/recommended",
  ],
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": "error",
    "no-console": "warn",
    "no-unused-vars": "warn",
    "node/no-unpublished-require": "off",
  },
};
