// <your_monorepo_root>/babel.config.cjs
/**
 * @file Universal Babel configuration for the DaitanJS monorepo.
 * @description This single configuration file is used by all packages.
 * It targets the current Node.js version for efficient backend builds
 * and provides separate configurations for ESM and CJS outputs.
 */
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ],
  ],
  env: {
    esm: {
      presets: [
        [
          '@babel/preset-env',
          {
            modules: false,
            targets: {
              node: 'current',
            },
          },
        ],
      ],
    },
    cjs: {
      presets: [
        [
          '@babel/preset-env',
          {
            modules: 'commonjs',
            targets: {
              node: 'current',
            },
          },
        ],
      ],
    },
  },
  plugins: ['@babel/plugin-transform-runtime'],
};
