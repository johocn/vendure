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
exports.ShippingProfileEnsureService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
/** 合并档案需覆盖的配送方式 code：store-pickup=R4 到店自取，courier-delivery=R2 快递到校 */
const MERGE_METHOD_CODES = ['store-pickup', 'courier-delivery'];
/**
 * 合并默认配送档案（R2/R4 档案冲突治本，三期）。
 *
 * 背景：cjk 分箱按变体 customFields.shippingProfileId 出配送方式，变体档案为单值，
 * R2 需含 courier-delivery 的档案、R4 需含 store-pickup 的档案，两者互顶。
 * 本服务 get-or-create 渠道租户默认档案并合并两种方式 → 把渠道内未绑档案的变体
 * 补绑到该默认档案（不触碰已显式绑定的变体），幂等可重复点击。
 *
 * 经 rawConnection 按实体名取 repo（避免对 cjk-plugin 的构建期依赖；
 * ShippingProfile 由 cjk-plugin 注册于同一进程，同 waimai-store.service 模式）。
 */
let ShippingProfileEnsureService = class ShippingProfileEnsureService {
    constructor(connection) {
        this.connection = connection;
    }
    async ensureDefaultShippingProfile(ctx, channelId) {
        var _a, _b;
        const channelRepo = this.connection.rawConnection.getRepository('Channel');
        const channel = await channelRepo.findOne({ where: { id: channelId } });
        if (!channel)
            throw new core_1.UserInputError(`渠道不存在: ${channelId}`);
        // 1) 按预期 code 找配送方式（全局/跨渠道检索，缺失则跳过并在结果中报告）
        const methodRepo = this.connection.rawConnection.getRepository('ShippingMethod');
        const allMethods = (await methodRepo.find());
        const found = [];
        const missingMethodCodes = [];
        for (const code of MERGE_METHOD_CODES) {
            const m = allMethods.find(x => x.code === code);
            if (m)
                found.push(m);
            else
                missingMethodCodes.push(code);
        }
        if (found.length === 0) {
            throw new core_1.UserInputError(`未找到任何预期配送方式（${MERGE_METHOD_CODES.join(' / ')}），请先在管理台创建`);
        }
        // 2) 方式幂等绑定到目标渠道（不绑渠道则 C 端 eligibleShippingMethods 不含它）
        for (const m of found) {
            const channels = (_a = m.channels) !== null && _a !== void 0 ? _a : [];
            if (!channels.some(c => Number(c.id) === Number(channelId))) {
                channels.push({ id: channelId });
                m.channels = channels;
                await methodRepo.save(m);
            }
        }
        // 3) get-or-create 渠道租户默认档案（union 补方式，不删除已有绑定）
        const profileRepo = this.connection.rawConnection.getRepository('ShippingProfile');
        let profile = (await profileRepo.findOne({
            where: { ownerChannelId: channelId, isGlobal: false, isTenantDefault: true },
            relations: ['shippingMethods'],
        }));
        if (profile) {
            const linked = [];
            const have = new Set(((_b = profile.shippingMethods) !== null && _b !== void 0 ? _b : []).map((m) => Number(m.id)));
            for (const m of found) {
                if (!have.has(Number(m.id)))
                    profile.shippingMethods.push({ id: m.id });
                linked.push(m.code);
            }
            profile.enabled = true;
            await profileRepo.save(profile);
            return {
                profileId: String(profile.id),
                profileName: profile.name,
                linkedMethodCodes: linked,
                missingMethodCodes,
                boundVariantCount: await this.bindUnboundVariants(channelId, String(profile.id)),
            };
        }
        // 新建前清掉同渠道其它默认标记（与 cjk ShippingProfileService.setTenantDefault 同语义）
        await profileRepo
            .createQueryBuilder()
            .update()
            .set({ isTenantDefault: false })
            .where('"ownerChannelId" = :channelId AND "isGlobal" = false', { channelId })
            .execute();
        profile = await profileRepo.save({
            name: '拾光达默认配送档案',
            code: `campus-default-${channelId}`,
            ownerChannelId: channelId,
            isGlobal: false,
            isTenantDefault: true,
            enabled: true,
            requiresAddress: true,
            requiresContact: false,
            channels: [{ id: channelId }],
            shippingMethods: found.map(m => ({ id: m.id })),
        });
        return {
            profileId: String(profile.id),
            profileName: profile.name,
            linkedMethodCodes: found.map(m => m.code),
            missingMethodCodes,
            boundVariantCount: await this.bindUnboundVariants(channelId, String(profile.id)),
        };
    }
    /** 渠道内未绑配送档案的变体补绑到 profileId（列名同 cjk assignToVariants 原生 SQL 口径）。 */
    async bindUnboundVariants(channelId, profileId) {
        const variantRepo = this.connection.rawConnection.getRepository('ProductVariant');
        const rows = await variantRepo
            .createQueryBuilder('v')
            .select('v.id', 'id')
            .innerJoin('v.channels', 'ch', 'ch.id = :channelId', { channelId })
            .where('v.customFieldsShippingprofileid IS NULL')
            .getRawMany();
        const ids = rows.map(r => Number(r.id));
        if (ids.length === 0)
            return 0;
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        await variantRepo.manager.query(`UPDATE product_variant SET "customFieldsShippingprofileid" = $1 WHERE id IN (${placeholders})`, [profileId, ...ids]);
        return ids.length;
    }
};
exports.ShippingProfileEnsureService = ShippingProfileEnsureService;
exports.ShippingProfileEnsureService = ShippingProfileEnsureService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], ShippingProfileEnsureService);
//# sourceMappingURL=shipping-profile-ensure.service.js.map