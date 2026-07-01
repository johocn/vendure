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
exports.TenantSetupService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
let TenantSetupService = class TenantSetupService {
    constructor(channelService) {
        this.channelService = channelService;
    }
    async getChannelPromotionPolicy(ctx) {
        var _a, _b;
        const channel = ctx.channel;
        const ccf = channel.customFields;
        return {
            couponStackable: (_a = ccf === null || ccf === void 0 ? void 0 : ccf.couponStackable) !== null && _a !== void 0 ? _a : false,
            maxStackableCount: (_b = ccf === null || ccf === void 0 ? void 0 : ccf.maxStackableCount) !== null && _b !== void 0 ? _b : null,
        };
    }
    async updateChannelPromotionPolicy(ctx, couponStackable, maxStackableCount) {
        const channel = ctx.channel;
        const ccf = channel.customFields;
        if (ccf) {
            ccf.couponStackable = couponStackable;
            if (maxStackableCount != null) {
                ccf.maxStackableCount = maxStackableCount;
            }
        }
        core_1.Logger.info(`Updated channel ${channel.code} promotion policy: stackable=${couponStackable}, max=${maxStackableCount}`, constants_1.loggerCtx);
    }
};
exports.TenantSetupService = TenantSetupService;
exports.TenantSetupService = TenantSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.ChannelService])
], TenantSetupService);
//# sourceMappingURL=tenant-setup.service.js.map