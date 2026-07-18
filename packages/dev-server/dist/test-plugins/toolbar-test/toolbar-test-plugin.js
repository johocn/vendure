"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolbarTestPlugin = void 0;
const core_1 = require("@vendure/core");
/**
 * A test plugin that demonstrates the toolbarItems extension point by adding
 * several items to the app shell header toolbar.
 */
let ToolbarTestPlugin = class ToolbarTestPlugin {
};
exports.ToolbarTestPlugin = ToolbarTestPlugin;
exports.ToolbarTestPlugin = ToolbarTestPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        dashboard: './dashboard/index.tsx',
    })
], ToolbarTestPlugin);
//# sourceMappingURL=toolbar-test-plugin.js.map