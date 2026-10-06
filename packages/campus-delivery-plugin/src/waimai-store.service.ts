import { Injectable } from '@nestjs/common';
import { Channel, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';

export interface WaimaiStore {
    channelId: number;
    channelToken: string;
    name: string;
    logo: string | null;
    tags: string[];
    monthlySales: number;
    promoText: string | null;
    paused: boolean;
    routesEnabled: string[];
    deliveryMinutes: number | null;
    minOrderAmount: number | null;
    deliveryFee: number | null;
    storeAddress: string | null;
    storePhone: string | null;
    storeNotice: string | null;
    errandBaseFee: number | null;
}

export interface CampusStoreConfigWithChannel {
    channelId: number;
    channelName: string;
    channelToken: string;
    routesEnabled: string[];
    deliveryMinutes: number | null;
    minOrderAmount: number | null;
    deliveryFee: number | null;
    storeAddress: string | null;
    storePhone: string | null;
    storeNotice: string | null;
    errandBaseFee: number | null;
}

const ROUTE_WHITELIST = ['R1', 'R2', 'R3', 'R4', 'R5'];

/** R4 自提点标记：campus 配置管理的本渠道门店自提点（幂等 upsert 键，复用 cjk PickupLocation 体系） */
const CAMPUS_R4_REMARK = 'campus-r4';

@Injectable()
export class WaimaiStoreService {
    constructor(private connection: TransactionalConnection) {}

    /** 店铺列表：有履约配置的渠道即外卖店铺（跨渠道公开元数据聚合，供 C 端首页）。
     * C 端进入店铺后用 channelToken 作 vendure-token 切换渠道拉菜单/下单。 */
    async listStores(ctx: RequestContext): Promise<WaimaiStore[]> {
        const configs = await this.connection.getRepository(ctx, CampusFulfillmentConfig).find();
        const byChannel = new Map(configs.map(c => [Number(c.channelId), c]));
        const channels = await this.connection.getRepository(ctx, Channel).find();
        const stores: WaimaiStore[] = [];
        for (const ch of channels) {
            const cfg = byChannel.get(Number(ch.id));
            if (!cfg) continue;
            if (ch.code === '__default_channel__') continue;   // 默认渠道是平台会话渠道，不是店铺（防脏配置污染 C 端列表/骑手大厅）
            const cf = (ch.customFields ?? {}) as any;
            stores.push({
                channelId: Number(ch.id),
                channelToken: ch.token,
                name: ch.code,
                logo: cf.waimaiLogo ?? null,
                tags: typeof cf.waimaiTags === 'string' && cf.waimaiTags.length
                    ? cf.waimaiTags.split(',').map((t: string) => t.trim()).filter(Boolean)
                    : [],
                monthlySales: cf.waimaiMonthlySales ?? 0,
                promoText: cf.waimaiPromoText ?? null,
                paused: cfg.paused,
                routesEnabled: cfg.routesEnabled ?? [],
                deliveryMinutes: cfg.deliveryMinutes ?? null,
                minOrderAmount: cfg.minOrderAmount ?? null,
                deliveryFee: cfg.deliveryFee ?? null,
                storeAddress: cfg.storeAddress ?? null,
                storePhone: cfg.storePhone ?? null,
                storeNotice: cfg.storeNotice ?? null,
                errandBaseFee: cfg.errandBaseFee ?? null,
            });
        }
        return stores;
    }

    /** admin：全店铺配置（跨渠道，join Channel 取店铺名/token；默认渠道是平台会话渠道，跳过） */
    async listStoreConfigs(ctx: RequestContext): Promise<CampusStoreConfigWithChannel[]> {
        const configs = await this.connection.getRepository(ctx, CampusFulfillmentConfig).find();
        const byChannel = new Map(configs.map(c => [Number(c.channelId), c]));
        const channels = await this.connection.getRepository(ctx, Channel).find();
        const out: CampusStoreConfigWithChannel[] = [];
        for (const ch of channels) {
            if (ch.code === '__default_channel__') continue;
            const cfg = byChannel.get(Number(ch.id));
            out.push(this.toConfigView(Number(ch.id), ch.code, ch.token, cfg));
        }
        return out;
    }

    /** admin：按 channelId upsert（幂等），routesEnabled 白名单 R1-R5，负数金额拒绝 */
    async updateStoreConfig(
        ctx: RequestContext,
        channelId: number,
        input: {
            routesEnabled: string[];
            deliveryMinutes?: number | null;
            minOrderAmount?: number | null;
            deliveryFee?: number | null;
            storeAddress?: string | null;
            storePhone?: string | null;
            storeNotice?: string | null;
            errandBaseFee?: number | null;
        },
    ): Promise<CampusStoreConfigWithChannel> {
        const bad = (input.routesEnabled ?? []).filter(r => !ROUTE_WHITELIST.includes(r));
        if (bad.length) throw new UserInputError(`不支持的配送路线: ${bad.join(', ')}（仅接受 R1-R5）`);
        const negative = (['deliveryMinutes', 'minOrderAmount', 'deliveryFee', 'errandBaseFee'] as const)
            .filter(k => input[k] != null && (input[k] as number) < 0);
        if (negative.length) throw new UserInputError(`不能为负数: ${negative.join(', ')}`);
        const chRepo = this.connection.getRepository(ctx, Channel);
        const ch = (await chRepo.find()).find(c => Number(c.id) === Number(channelId));
        if (!ch) throw new UserInputError(`渠道不存在: ${channelId}`);
        const repo = this.connection.getRepository(ctx, CampusFulfillmentConfig);
        let cfg = await repo.findOne({ where: { channelId: channelId as any } });
        if (!cfg) cfg = new CampusFulfillmentConfig({ channelId: channelId as any });
        cfg.routesEnabled = input.routesEnabled;
        cfg.deliveryMinutes = input.deliveryMinutes ?? null;
        cfg.minOrderAmount = input.minOrderAmount ?? null;
        cfg.deliveryFee = input.deliveryFee ?? null;
        cfg.storeAddress = input.storeAddress ?? null;
        cfg.storePhone = input.storePhone ?? null;
        cfg.storeNotice = input.storeNotice ?? null;
        cfg.errandBaseFee = input.errandBaseFee ?? null;
        await repo.save(cfg);
        const address = (input.storeAddress ?? '').trim();
        if (address) {
            // R4：同步幂等 upsert 本渠道门店自提点（名称=店铺名，地址=storeAddress），核销走 pickup_redemption 零新表
            await this.upsertStorePickupLocation(Number(channelId), ch.code, address, (input.storePhone ?? '').trim() || null);
        }
        return this.toConfigView(channelId, ch.code, ch.token, cfg);
    }

    /** 经 rawConnection 按实体名取 repo（避免对 cjk-plugin 的构建期依赖；PickupLocation 由 cjk-plugin 注册于同一进程）。
     * 可见性：isPublic=false + ownerChannelId=本渠道 + channels 含本渠道 → shop 端 applyVisibility 对本渠道可见（cjk pickup-location.service.ts:35）。 */
    private async upsertStorePickupLocation(channelId: number, name: string, address: string, phone: string | null) {
        const repo = this.connection.rawConnection.getRepository('PickupLocation');
        const existing = await repo.findOne({ where: { ownerChannelId: channelId, remark: CAMPUS_R4_REMARK } });
        if (existing) {
            existing.name = name;
            existing.address = address;
            existing.phoneNumber = phone;
            existing.enabled = true;
            await repo.save(existing);
            return existing;
        }
        return repo.save({
            name,
            address,
            phoneNumber: phone,
            type: 'store',
            stockType: 'own',
            enabled: true,
            isPublic: false,
            ownerChannelId: channelId,
            channels: [{ id: channelId }],
            remark: CAMPUS_R4_REMARK,
        });
    }

    private toConfigView(
        channelId: number,
        channelName: string,
        channelToken: string,
        cfg: CampusFulfillmentConfig | undefined,
    ): CampusStoreConfigWithChannel {
        return {
            channelId,
            channelName,
            channelToken,
            routesEnabled: cfg?.routesEnabled ?? [],
            deliveryMinutes: cfg?.deliveryMinutes ?? null,
            minOrderAmount: cfg?.minOrderAmount ?? null,
            deliveryFee: cfg?.deliveryFee ?? null,
            storeAddress: cfg?.storeAddress ?? null,
            storePhone: cfg?.storePhone ?? null,
            storeNotice: cfg?.storeNotice ?? null,
            errandBaseFee: cfg?.errandBaseFee ?? null,
        };
    }
}
