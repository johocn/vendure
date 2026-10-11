"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DiyPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiyPlugin = exports.DiyServiceStub = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const diy_category_entity_1 = require("./entities/diy-category.entity");
const diy_material_entity_1 = require("./entities/diy-material.entity");
const diy_template_entity_1 = require("./entities/diy-template.entity");
let DiyServiceStub = class DiyServiceStub {
};
exports.DiyServiceStub = DiyServiceStub;
exports.DiyServiceStub = DiyServiceStub = __decorate([
    (0, common_1.Injectable)()
], DiyServiceStub);
let DiyPlugin = DiyPlugin_1 = class DiyPlugin {
    static init(options) {
        DiyPlugin_1.options = options !== null && options !== void 0 ? options : {};
        return DiyPlugin_1;
    }
    async onApplicationBootstrap() {
        core_1.Logger.info('DiyPlugin initialized (skeleton)', constants_1.loggerCtx);
    }
};
exports.DiyPlugin = DiyPlugin;
DiyPlugin.options = {};
exports.DiyPlugin = DiyPlugin = DiyPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [diy_category_entity_1.DiyCategory, diy_material_entity_1.DiyMaterial, diy_template_entity_1.DiyTemplate],
        providers: [{ provide: constants_1.PLUGIN_INIT_OPTIONS, useFactory: () => DiyPlugin.options }, DiyServiceStub],
        exports: [],
        compatibility: '^3.0.0',
    })
], DiyPlugin);
//# sourceMappingURL=diy-plugin.js.map