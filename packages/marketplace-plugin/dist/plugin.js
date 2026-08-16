"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MarketplacePlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketplacePlugin = void 0;
const core_1 = require("@vendure/core");
const core_2 = require("@vendure/core");
const constants_1 = require("./constants");
let MarketplacePlugin = MarketplacePlugin_1 = class MarketplacePlugin {
    static init(options) {
        MarketplacePlugin_1.options = options;
        return MarketplacePlugin_1;
    }
};
exports.MarketplacePlugin = MarketplacePlugin;
exports.MarketplacePlugin = MarketplacePlugin = MarketplacePlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_2.PluginCommonModule],
        providers: [
            { provide: constants_1.MARKETPLACE_PLUGIN_OPTIONS, useFactory: () => MarketplacePlugin.options },
        ],
    })
], MarketplacePlugin);
