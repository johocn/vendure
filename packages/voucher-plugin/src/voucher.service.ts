import { Inject, Injectable } from '@nestjs/common';
import {
    AdministratorService,
    Customer,
    EntityNotFoundError,
    ForbiddenError,
    ID,
    LanguageCode,
    Order,
    OrderService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Shop } from '@vendure/shop-plugin';

import { VOUCHER_PLUGIN_OPTIONS, VoucherPluginOptions } from './voucher.options';
import { ServiceVoucher, VoucherStatus } from './service-voucher.entity';
import { VoucherBooking } from './voucher-booking.entity';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_EFFECTIVE_DAYS = 90;
const MS_PER_DAY = 86400000;

@Injectable()
export class VoucherService {
    constructor(
        @Inject(VOUCHER_PLUGIN_OPTIONS) private options: VoucherPluginOptions,
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private administratorService: AdministratorService,
    ) {}

    // ---------- 店主域鉴权 ----------

    /** 归属解析 + 校验：activeUserId → Administrator.user → Shop.administratorId → status==='active'。 */
    async requireMyShop(ctx: RequestContext): Promise<Shop> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const admin = await this.administratorService.findOneByUserId(ctx, ctx.activeUserId);
        if (!admin || admin.id == null) throw new ForbiddenError();
        const shop = await this.connection
            .getRepository(ctx, Shop)
            .findOne({ where: { administratorId: admin.id as number } } as any);
        if (!shop || shop.status !== 'active') throw new ForbiddenError();
        return shop;
    }

    // ---------- 券生成（PaymentSettled 联动） ----------

    /**
     * 幂等生成：按 orderId 查 ServiceVoucher，存在即返回；否则遍历订单行，仅对
     * 「Product.customFields.serviceType 非空」的服务型商品每件生成一张券（阶段22 铁律：
     * OrderLine 无私货 productId，须走 line.productVariant.product）。
     */
    async getOrCreateVouchersForOrder(ctx: RequestContext, order: Order): Promise<ServiceVoucher[]> {
        const orderId = order.id as number;
        const repo = this.connection.getRepository(ctx, ServiceVoucher);
        const existing = await repo.find({ where: { orderId } });
        if (existing.length > 0) {
            return existing; // 幂等：一单一轮最多生成一次
        }
        const fresh = await this.orderService.findOne(ctx, orderId, [
            'customer',
            'lines',
            'lines.productVariant',
            'lines.productVariant.product',
            'lines.productVariant.product.translations',
            'lines.productVariant.translations',
        ]);
        if (!fresh) return [];
        const customerId = fresh.customer?.id as number;
        const effectiveDays = this.options.defaultEffectiveDays ?? DEFAULT_EFFECTIVE_DAYS;
        const expiresAt = new Date(Date.now() + effectiveDays * MS_PER_DAY);
        const vouchers: ServiceVoucher[] = [];
        for (const line of fresh.lines ?? []) {
            const product = line.productVariant?.product;
            const cf = (product?.customFields ?? {}) as any;
            const serviceType = cf.serviceType;
            if (!serviceType) continue; // 非服务型商品不生成券
            const shopIdVal = cf.shopId;
            if (shopIdVal == null) continue; // 未归属店铺的服务券不生成
            const shopId = Number(shopIdVal);
            const productVoucherName =
                this.pickName(product?.translations, ctx.languageCode) ||
                this.pickName(line.productVariant?.translations, ctx.languageCode) ||
                '';
            for (let i = 0; i < line.quantity; i++) {
                const voucher = repo.create({
                    channelId: ctx.channelId as number,
                    orderId,
                    customerId,
                    shopId,
                    productVariantId: line.productVariant?.id as number,
                    productVoucherName,
                    code: await this.genUniqueCode(ctx, repo),
                    status: 'usable' as VoucherStatus,
                    effectiveDays,
                    expiresAt,
                });
                voucher.channels = [ctx.channel];
                vouchers.push(await repo.save(voucher));
            }
        }
        return vouchers;
    }

    // ---------- 店主核销 / 展示 / 变更 ----------

    /** 核销：店主在其店内找 code 对应券，usable → used+usedAt。 */
    async redeemVoucher(ctx: RequestContext, code: string): Promise<ServiceVoucher> {
        const shop = await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, ServiceVoucher);
        const voucher = await repo.findOne({ where: { code, shopId: shop.id as number } });
        if (!voucher) throw new EntityNotFoundError('ServiceVoucher', code);
        if (voucher.status !== 'usable') {
            throw new UserInputError(`Voucher is not usable (current status: ${voucher.status})`);
        }
        voucher.status = 'used';
        voucher.usedAt = new Date();
        return repo.save(voucher);
    }

    /** 扫码展示：店主在其店内按 code 查回，未命中返回 undefined。 */
    async findVoucher(ctx: RequestContext, code: string): Promise<ServiceVoucher | undefined> {
        const shop = await this.requireMyShop(ctx);
        const voucher = await this.connection
            .getRepository(ctx, ServiceVoucher)
            .findOne({ where: { code, shopId: shop.id as number } });
        return voucher ?? undefined;
    }

    /** 延期：used 不可延，expiresAt += days。 */
    async extendVoucher(ctx: RequestContext, voucherId: ID, days: number): Promise<ServiceVoucher> {
        const shop = await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, ServiceVoucher);
        const voucher = await repo.findOne({ where: { id: Number(voucherId), shopId: shop.id as number } });
        if (!voucher) throw new EntityNotFoundError('ServiceVoucher', voucherId);
        if (voucher.status === 'used') {
            throw new UserInputError('Used voucher cannot be extended');
        }
        const base = voucher.expiresAt ?? new Date();
        voucher.expiresAt = new Date(base.getTime() + days * MS_PER_DAY);
        return repo.save(voucher);
    }

    /** 换券：旧券置 voided，新建同信息新券（新 code，status usable，expiresAt 重置）。 */
    async exchangeVoucher(ctx: RequestContext, voucherId: ID): Promise<ServiceVoucher> {
        const shop = await this.requireMyShop(ctx);
        const repo = this.connection.getRepository(ctx, ServiceVoucher);
        const voucher = await repo.findOne({ where: { id: Number(voucherId), shopId: shop.id as number } });
        if (!voucher) throw new EntityNotFoundError('ServiceVoucher', voucherId);
        voucher.status = 'voided';
        await repo.save(voucher);
        const effectiveDays = voucher.effectiveDays;
        const next = repo.create({
            channelId: voucher.channelId,
            orderId: voucher.orderId, // 换券继承原单归属，保证 orderId 非空
            customerId: voucher.customerId,
            shopId: voucher.shopId,
            productVariantId: voucher.productVariantId,
            productVoucherName: voucher.productVoucherName,
            code: await this.genUniqueCode(ctx, repo),
            status: 'usable' as VoucherStatus,
            effectiveDays,
            expiresAt: new Date(Date.now() + effectiveDays * MS_PER_DAY),
        });
        next.channels = [ctx.channel];
        return repo.save(next);
    }

    /** 过期扫描：usable 且 expiresAt < now → expired。返回处理条数（JobQueue/admin mutation 调用）。 */
    async markExpired(_ctx: RequestContext): Promise<number> {
        const repo = this.connection.rawConnection.getRepository(ServiceVoucher);
        const rows = await repo.find({ where: { status: 'usable' } as any });
        let count = 0;
        const now = Date.now();
        for (const v of rows) {
            if (v.expiresAt && v.expiresAt.getTime() < now) {
                v.status = 'expired';
                await repo.save(v);
                count++;
            }
        }
        return count;
    }

    /** 退款成功联动：该单全部 usable 券 → refunded+refundedAt（RefundStateTransitionEvent Settled 订阅调用）。 */
    async markRefundedOnOrder(ctx: RequestContext, orderId: ID): Promise<number> {
        const repo = this.connection.getRepository(ctx, ServiceVoucher);
        const rows = await repo.find({ where: { orderId: Number(orderId), status: 'usable' } });
        let count = 0;
        for (const v of rows) {
            v.status = 'refunded';
            v.refundedAt = new Date();
            await repo.save(v);
            count++;
        }
        return count;
    }

    // ---------- 预约 ----------

    /** 建预约（幂等：一券最多一档）。 */
    async createBooking(
        ctx: RequestContext,
        voucherId: ID,
        slotAt: Date | string,
        customerCount: number,
    ): Promise<VoucherBooking> {
        const repo = this.connection.getRepository(ctx, VoucherBooking);
        const existing = await repo.findOne({ where: { voucherId: Number(voucherId) } });
        if (existing) return existing;
        const voucher = await this.connection
            .getRepository(ctx, ServiceVoucher)
            .findOne({ where: { id: Number(voucherId) } });
        if (!voucher) throw new EntityNotFoundError('ServiceVoucher', voucherId);
        const booking = repo.create({
            channelId: ctx.channelId as number,
            voucherId: voucher.id as number,
            customerId: voucher.customerId,
            shopId: voucher.shopId,
            slotAt: new Date(slotAt),
            customerCount,
        });
        booking.channels = [ctx.channel];
        return repo.save(booking);
    }

    /** 查询某券的预约档。 */
    async bookingsForVoucher(ctx: RequestContext, voucherId: ID): Promise<VoucherBooking[]> {
        return this.connection
            .getRepository(ctx, VoucherBooking)
            .find({ where: { voucherId: Number(voucherId) } });
    }

    // ---------- C 端 ----------

    /** C 端当前顾客券列表：customerId = activeUserId 对应用户的 Customer（按 customer.user.id 关联）。 */
    async myVouchers(ctx: RequestContext): Promise<ServiceVoucher[]> {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const customer = await this.connection
            .getRepository(ctx, Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } as any });
        if (!customer) return [];
        return this.connection.getRepository(ctx, ServiceVoucher).find({
            where: { customerId: customer.id as number, channelId: ctx.channelId as number },
            order: { createdAt: 'DESC' as 'DESC' },
        });
    }

    /** 管理端全局券列表（本 channel）。 */
    async vouchers(ctx: RequestContext): Promise<ServiceVoucher[]> {
        return this.connection.getRepository(ctx, ServiceVoucher).find({
            where: { channelId: ctx.channelId as number },
            order: { createdAt: 'DESC' as 'DESC' },
        });
    }

    // ---------- 私有助手 ----------

    private pickName(
        translations: Array<{ languageCode?: LanguageCode; name?: string }> | undefined,
        lang: LanguageCode,
    ): string {
        const t = (translations ?? []).find(tr => tr?.languageCode === lang) ?? (translations ?? [])[0];
        return t?.name ?? '';
    }

    /** 保证唯一核销码：时间戳+随机，冲突重试。 */
    private async genUniqueCode(
        ctx: RequestContext,
        repo: ReturnType<TransactionalConnection['getRepository']> | any,
    ): Promise<string> {
        for (let i = 0; i < 10; i++) {
            const ts = Date.now().toString(36).toUpperCase();
            let rnd = '';
            for (let j = 0; j < 6; j++) {
                rnd += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
            }
            const code = `${ts}${rnd}`;
            const hit = await repo.findOne({ where: { code } });
            if (!hit) return code;
        }
        throw new UserInputError('Failed to generate a unique voucher code');
    }
}