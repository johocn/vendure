"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manageDashboardGlobalViews = exports.defaultAvailableLocales = exports.defaultAvailableLanguages = exports.defaultLocale = exports.defaultLanguage = exports.loggerCtx = exports.DEFAULT_APP_PATH = void 0;
const core_1 = require("@vendure/core");
const node_path_1 = require("node:path");
exports.DEFAULT_APP_PATH = (0, node_path_1.join)(__dirname, 'dist');
exports.loggerCtx = 'DashboardPlugin';
exports.defaultLanguage = 'en';
exports.defaultLocale = undefined;
exports.defaultAvailableLanguages = [
    'en',
    'de',
    'es',
    'cs',
    'zh_Hans',
    'pt_BR',
    'pt_PT',
    'zh_Hant',
    'bg',
    'nl',
];
exports.defaultAvailableLocales = [
    'en-US',
    'de-DE',
    'es-ES',
    'zh-CN',
    'zh-TW',
    'pt-BR',
    'pt-PT',
    'bg_BG',
    'nl-NL',
];
exports.manageDashboardGlobalViews = new core_1.RwPermissionDefinition('DashboardGlobalViews');
