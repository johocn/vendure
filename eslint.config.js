// 根级 flat 配置：阻断向上查找到 e:\code\eslint.config.mjs（Strapi 项目配置，
// 引用补丁进根 node_modules 的自定义规则 no-unassigned-vars，vendure 的 eslint 副本无此规则导致崩溃）。
// 用 FlatCompat 将既有 .eslintrc.js 转成 flat config，行为与 eslintrc 模式一致。
const { FlatCompat } = require('@eslint/eslintrc');
const path = require('path');
const base = require('./.eslintrc.js');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
      '**/generated*/**',
      '/packages/ui-devkit/scaffold/**/*',
    ],
  },
  ...compat.config(base),
];
