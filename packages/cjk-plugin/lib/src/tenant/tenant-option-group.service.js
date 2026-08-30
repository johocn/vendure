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
exports.TenantOptionGroupService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
let TenantOptionGroupService = class TenantOptionGroupService {
    constructor(connection, channelService) {
        this.connection = connection;
        this.channelService = channelService;
    }
    /** 取某组当前语言的名称（从 translations 抽 zh_Hans，回退首个）。 */
    groupName(g) {
        var _a, _b, _c;
        const ts = ((_a = g.translations) !== null && _a !== void 0 ? _a : []);
        return (((_b = ts.find((t) => t.languageCode === 'zh_Hans')) === null || _b === void 0 ? void 0 : _b.name) ||
            ((_c = ts.find((t) => t.name)) === null || _c === void 0 ? void 0 : _c.name) ||
            String(g.id));
    }
    optionName(o) {
        var _a, _b, _c;
        const ts = ((_a = o.translations) !== null && _a !== void 0 ? _a : []);
        return (((_b = ts.find((t) => t.languageCode === 'zh_Hans')) === null || _b === void 0 ? void 0 : _b.name) ||
            ((_c = ts.find((t) => t.name)) === null || _c === void 0 ? void 0 : _c.name) ||
            String(o.id));
    }
    /** 返回「本租户渠道私有组 + 默认渠道平台组」并集（跨渠道只读，不改归属）。 */
    async reusableOptionGroups(ctx) {
        var _a, _b, _c, _d;
        const [defaultChannel, groups] = await Promise.all([
            this.channelService.getDefaultChannel(ctx),
            this.connection.rawConnection.getRepository(core_1.ProductOptionGroup).find({
                relations: ['channels', 'options', 'options.translations', 'translations'],
            }),
        ]);
        const defaultId = String((_a = defaultChannel === null || defaultChannel === void 0 ? void 0 : defaultChannel.id) !== null && _a !== void 0 ? _a : '');
        const tenantId = String((_b = ctx.channelId) !== null && _b !== void 0 ? _b : '');
        const out = [];
        for (const g of groups) {
            const chans = (_c = g.channels) !== null && _c !== void 0 ? _c : [];
            const has = (id) => id && chans.some((c) => String(c.id) === id);
            const onTenant = has(tenantId);
            const onDefault = has(defaultId);
            const unattached = chans.length === 0;
            // 平台组判定：本租户私有组 或 平台组（挂在默认渠道） 或 未挂任何渠道的组
            if (onTenant || onDefault || unattached) {
                out.push({
                    id: g.id,
                    name: this.groupName(g),
                    options: ((_d = g.options) !== null && _d !== void 0 ? _d : []).map((o) => ({
                        id: o.id,
                        name: this.optionName(o),
                    })),
                });
            }
        }
        return out;
    }
    /** 把已有规格组直接绑定到商品（跨渠道直连 Product.optionGroups，幂等）。 */
    async reuseOptionGroupForProduct(productId, optionGroupId) {
        var _a;
        const groupRepo = this.connection.rawConnection.getRepository(core_1.ProductOptionGroup);
        const productRepo = this.connection.rawConnection.getRepository(core_1.Product);
        const group = await groupRepo.findOne({
            where: { id: String(optionGroupId) },
            relations: ['options'],
        });
        if (!group)
            return false;
        const product = await productRepo.findOne({
            where: { id: String(productId) },
            relations: ['optionGroups'],
        });
        if (!product)
            return false;
        const existing = ((_a = product.optionGroups) !== null && _a !== void 0 ? _a : []).some((g) => String(g.id) === String(group.id));
        if (!existing) {
            product.optionGroups.push(group);
            await productRepo.save(product, { reload: false });
        }
        return true;
    }
};
exports.TenantOptionGroupService = TenantOptionGroupService;
exports.TenantOptionGroupService = TenantOptionGroupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ChannelService])
], TenantOptionGroupService);
//# sourceMappingURL=tenant-option-group.service.js.map