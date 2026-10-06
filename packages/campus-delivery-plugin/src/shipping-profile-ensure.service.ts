import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

/**
 * 合并默认配送档案结果。
 */
export interface CampusEnsureProfileResult {
    profileId: string;
    profileName: string;
    /** 已挂到档案并绑定到渠道的配送方式 code */
    linkedMethodCodes: string[];
    /** 按预期 code 未找到的配送方式（渠道缺该方式时 R2/R4 对应路线不可用） */
    missingMethodCodes: string[];
    /** 本次补绑定的「未绑档案」变体数 */
    boundVariantCount: number;
}

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
@Injectable()
export class ShippingProfileEnsureService {
    constructor(private connection: TransactionalConnection) {}

    async ensureDefaultShippingProfile(
        ctx: RequestContext,
        channelId: number,
    ): Promise<CampusEnsureProfileResult> {
        const channelRepo = this.connection.rawConnection.getRepository('Channel');
        const channel = await channelRepo.findOne({ where: { id: channelId } });
        if (!channel) throw new UserInputError(`渠道不存在: ${channelId}`);

        // 1) 按预期 code 找配送方式（全局/跨渠道检索，缺失则跳过并在结果中报告）
        const methodRepo = this.connection.rawConnection.getRepository('ShippingMethod');
        const allMethods = (await methodRepo.find()) as Array<{ id: number; code: string; channels: Array<{ id: number }> }>;
        const found: typeof allMethods = [];
        const missingMethodCodes: string[] = [];
        for (const code of MERGE_METHOD_CODES) {
            const m = allMethods.find(x => x.code === code);
            if (m) found.push(m);
            else missingMethodCodes.push(code);
        }
        if (found.length === 0) {
            throw new UserInputError(`未找到任何预期配送方式（${MERGE_METHOD_CODES.join(' / ')}），请先在管理台创建`);
        }

        // 2) 方式幂等绑定到目标渠道（不绑渠道则 C 端 eligibleShippingMethods 不含它）
        for (const m of found) {
            const channels = m.channels ?? [];
            if (!channels.some(c => Number(c.id) === Number(channelId))) {
                channels.push({ id: channelId } as any);
                m.channels = channels;
                await methodRepo.save(m);
            }
        }

        // 3) get-or-create 渠道租户默认档案（union 补方式，不删除已有绑定）
        const profileRepo = this.connection.rawConnection.getRepository('ShippingProfile');
        let profile = (await profileRepo.findOne({
            where: { ownerChannelId: channelId, isGlobal: false, isTenantDefault: true },
            relations: ['shippingMethods'],
        })) as ((any & { shippingMethods: Array<{ id: number }> }) | undefined);
        if (profile) {
            const linked: string[] = [];
            const have = new Set((profile.shippingMethods ?? []).map((m: { id: number }) => Number(m.id)));
            for (const m of found) {
                if (!have.has(Number(m.id))) profile.shippingMethods.push({ id: m.id } as any);
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
        } as any);
        return {
            profileId: String(profile.id),
            profileName: profile.name,
            linkedMethodCodes: found.map(m => m.code),
            missingMethodCodes,
            boundVariantCount: await this.bindUnboundVariants(channelId, String(profile.id)),
        };
    }

    /** 渠道内未绑配送档案的变体补绑到 profileId（列名同 cjk assignToVariants 原生 SQL 口径）。 */
    private async bindUnboundVariants(channelId: number, profileId: string): Promise<number> {
        const variantRepo = this.connection.rawConnection.getRepository('ProductVariant');
        const rows = await variantRepo
            .createQueryBuilder('v')
            .select('v.id', 'id')
            .innerJoin('v.channels', 'ch', 'ch.id = :channelId', { channelId })
            .where('v.customFieldsShippingprofileid IS NULL')
            .getRawMany<{ id: number }>();
        const ids = rows.map(r => Number(r.id));
        if (ids.length === 0) return 0;
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        await variantRepo.manager.query(
            `UPDATE product_variant SET "customFieldsShippingprofileid" = $1 WHERE id IN (${placeholders})`,
            [profileId, ...ids],
        );
        return ids.length;
    }
}
