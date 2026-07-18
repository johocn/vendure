"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessContextPlugin = void 0;
const core_1 = require("@vendure/core");
/**
 * Testing whether the ProcessContext service is giving the correct results.
 */
let ProcessContextPlugin = class ProcessContextPlugin {
    constructor(processContext) {
        this.processContext = processContext;
    }
    onApplicationBootstrap() {
        core_1.Logger.warn(`onApplicationBootstrap: isServer: ${this.processContext.isServer}`);
    }
    onModuleInit() {
        core_1.Logger.warn(`onModuleInit: isServer: ${this.processContext.isServer}`);
    }
};
exports.ProcessContextPlugin = ProcessContextPlugin;
exports.ProcessContextPlugin = ProcessContextPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
    }),
    __metadata("design:paramtypes", [core_1.ProcessContext])
], ProcessContextPlugin);
//# sourceMappingURL=process-context-plugin.js.map