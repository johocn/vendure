"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UiExtensionsLibraryPlugin = void 0;
const path_1 = __importDefault(require("path"));
class UiExtensionsLibraryPlugin {
}
exports.UiExtensionsLibraryPlugin = UiExtensionsLibraryPlugin;
UiExtensionsLibraryPlugin.uiExtensions = {
    id: 'ui-extensions-library',
    extensionPath: path_1.default.join(__dirname, 'ui'),
    routes: [{ route: 'ui-library', filePath: 'routes.ts' }],
    providers: ['providers.ts'],
};
//# sourceMappingURL=ui-extensions-library.plugin.js.map