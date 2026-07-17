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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloorBuilderPlugin = void 0;
const core_1 = require("@vendure/core");
let FloorBuilderPlugin = class FloorBuilderPlugin {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    onApplicationBootstrap() {
        // 商品删除时，清理 floorItemConfig 中的悬挂 productId 引用
        this.eventBus.ofType(core_1.ProductEvent).subscribe(async (event) => {
            if (event.type !== 'deleted')
                return;
            // struct list 的悬挂引用在前端查询时跳过即可，无需后端清理
            // 此处仅记录日志，便于排查
            console.log(`[FloorBuilderPlugin] Product deleted: ${event.entity.id}, floorItemConfig references may be orphaned`);
        });
    }
};
exports.FloorBuilderPlugin = FloorBuilderPlugin;
exports.FloorBuilderPlugin = FloorBuilderPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        dashboard: './dashboard/index.tsx',
    }),
    __metadata("design:paramtypes", [typeof (_a = typeof core_1.EventBus !== "undefined" && core_1.EventBus) === "function" ? _a : Object])
], FloorBuilderPlugin);
