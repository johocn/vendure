import { Inject, Injectable } from '@nestjs/common';
import { ConfigService, ID, RequestContext, OrderService, TransactionalConnection, Order } from '@vendure/core';
import {
    generateRedemptionCode,
    encryptRedemptionCode,
    redemptionFingerprint,
    decryptRedemptionCode,
    redemptionQrPayload,
    redemptionBarcodePayload,
    computeRedemptionStatus, RedemptionStatus,
} from './redemption-crypto';

@Injectable()
export class RedemptionCodeService {
    private readonly keyHex: string;
    private readonly graceDays: number;
    private readonly expireRemindHours: number;

    constructor(
        private orderService: OrderService,
        private connection: TransactionalConnection,
        configService: ConfigService,
    ) {
        this.keyHex = process.env.REDEMPTION_KEY ?? '7'.repeat(64); // dev 默认；生产必由运维注入
        if (process.env.REDEMPTION_KEY === undefined && process.env.NODE_ENV === 'production') {
            throw new Error('REDEMPTION_KEY 必须在生产环境注入（32 字节 hex）');
        }
        this.graceDays = Number((configService as any).get('pickup.redeemGraceDays')) || 7;
        this.expireRemindHours = Number((configService as any).get('pickup.redeemExpireRemindHours')) || 24;
    }

    private cf(order: Order): Record<string, any> {
        return (order.customFields ?? {}) as Record<string, any>;
    }

    private async writeExpiry(ctx: RequestContext, orderId: ID, placedAt: Date | null | undefined): Promise<void> {
        const base = placedAt ?? new Date();
        const expiresAt = new Date(base.getTime() + this.graceDays * 24 * 3600_000);
        // 多次调用的保持一致：字段级写 expiresAt，version 不在此递增（重发才 +1）
        await this.orderService.updateCustomFields(ctx, orderId, {
            redeemExpiresAt: expiresAt.toISOString(),
        } as any);
    }

    /**
     * 幂等确保订单已生成核销码。返回解密的明文核销码。
     */
    async ensure(ctx: RequestContext, orderId: ID): Promise<string> {
        const order = (await this.orderService.findOne(ctx, orderId, [])) as Order | undefined;
        if (!order) throw new Error('order not found');
        const cf = this.cf(order);
        if (cf.redeemCodeCipher && cf.redeemCodeIv) {
            // 历史单缺有效期：补算（幂等；已在生产跑过的单补上 graceDays 起算）
            if (!cf.redeemExpiresAt) {
                await this.writeExpiry(ctx, orderId, order.orderPlacedAt);
            }
            return decryptRedemptionCode(cf.redeemCodeCipher, cf.redeemCodeIv, this.keyHex);
        }
        const code = generateRedemptionCode();
        const { cipher, iv } = encryptRedemptionCode(code, this.keyHex);
        const channelToken = ctx.channel?.token ?? String(ctx.channelId ?? '');
        const hash = redemptionFingerprint(code, this.keyHex, channelToken);
        await this.orderService.updateCustomFields(ctx, orderId, {
            redeemCodeCipher: cipher,
            redeemCodeIv: iv,
            redeemCodeHash: hash,
            redeemExpiresAt: new Date((order.orderPlacedAt ?? new Date()).getTime() + this.graceDays * 24 * 3600_000).toISOString(),
            redeemVersion: 1,
            redeemReissuedAt: new Date().toISOString(),
        } as any);
        return code;
    }

    async getWithQr(
        ctx: RequestContext,
        orderId: ID,
        orderCode: string,
    ): Promise<{
        code: string; qrPayload: string; barcode: string; claimed: boolean;
        status: RedemptionStatus; expiresAt: string | null; version: number; reissueable: boolean;
    }> {
        const order = (await this.orderService.findOne(ctx, orderId, [])) as Order | undefined;
        if (!order) throw new Error('order not found');
        const cf = this.cf(order);
        const code =
            cf.redeemCodeCipher && cf.redeemCodeIv
                ? decryptRedemptionCode(cf.redeemCodeCipher, cf.redeemCodeIv, this.keyHex)
                : await this.ensure(ctx, orderId);
        const claimed = !!cf.redeemClaimed;
        const expiresAt: string | null = cf.redeemExpiresAt ?? null;
        const version = Number(cf.redeemVersion) || 1;
        const now = new Date();
        const status = computeRedemptionStatus(claimed, expiresAt, now, this.expireRemindHours);
        return {
            code,
            qrPayload: redemptionQrPayload(orderCode, code, this.keyHex),
            barcode: redemptionBarcodePayload(orderCode, code),
            claimed,
            status,
            expiresAt,
            version,
            reissueable: !claimed,
        };
    }

    /**
     * 管理端按输入码定位（限当前租户 Channel）。返回订单指针或 null。
     * Order 是 ChannelAware（ManyToMany order.channels），按 channelId 归属多租户隔离。
     * redeemCodeHash 存于 Order.customFields jsonb 列，用 jsonb 字段提取（同 sales-plugin 写法）。
     */
    async lookupByCode(ctx: RequestContext, inputCode: string): Promise<Order | null> {
        const code = inputCode.trim().toUpperCase();
        const channelToken = ctx.channel?.token ?? String(ctx.channelId ?? '');
        const hash = redemptionFingerprint(code, this.keyHex, channelToken);
        const qb = this.connection
            .getRepository(ctx, Order)
            .createQueryBuilder('order')
            .innerJoin('order.channels', 'ch', 'ch.id = :cid', { cid: ctx.channelId })
            .where('order.customFields.redeemCodeHash = :h', { h: hash });
        return qb.getOne();
    }

    async claim(ctx: RequestContext, orderId: ID): Promise<{ already: boolean; claimedAt: Date }> {
        const order = (await this.orderService.findOne(ctx, orderId, [])) as Order | undefined;
        if (!order) throw new Error('order not found');
        const cf = this.cf(order);
        if (cf.redeemClaimed) return { already: true, claimedAt: cf.redeemClaimedAt };
        await this.orderService.updateCustomFields(ctx, orderId, {
            redeemClaimed: true,
            redeemClaimedAt: new Date(),
        } as any);
        return { already: false, claimedAt: new Date() };
    }

    /**
     * 作废重发：已核销单禁止重发（一次性闭环）。新码重算密文/指纹并覆盖 → lookupByCode 命中激活码，旧码自然失效。
     */
    async reissue(ctx: RequestContext, orderId: ID): Promise<{
        code: string; qrPayload: string; barcode: string; claimed: boolean;
        status: RedemptionStatus; expiresAt: string; version: number; reissueable: boolean;
    }> {
        const order = (await this.orderService.findOne(ctx, orderId, [])) as Order | undefined;
        if (!order) throw new Error('order not found');
        const cf = this.cf(order);
        if (cf.redeemClaimed) {
            throw new Error('redemption.already_claimed');
        }
        const orderCode = order.code;
        const code = generateRedemptionCode();
        const { cipher, iv } = encryptRedemptionCode(code, this.keyHex);
        const channelToken = ctx.channel?.token ?? String(ctx.channelId ?? '');
        const hash = redemptionFingerprint(code, this.keyHex, channelToken);
        const version = (Number(cf.redeemVersion) || 1) + 1;
        const expiresAt = new Date(new Date().getTime() + this.graceDays * 24 * 3600_000).toISOString();
        await this.orderService.updateCustomFields(ctx, orderId, {
            redeemCodeCipher: cipher,
            redeemCodeIv: iv,
            redeemCodeHash: hash,
            redeemVersion: version,
            redeemReissuedAt: new Date(),
            redeemExpiresAt: expiresAt,
        } as any);
        return {
            code,
            qrPayload: redemptionQrPayload(orderCode, code, this.keyHex),
            barcode: redemptionBarcodePayload(orderCode, code),
            claimed: false,
            status: 'active',
            expiresAt,
            version,
            reissueable: true,
        };
    }
}