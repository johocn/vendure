import { Injectable } from '@nestjs/common';
import {
    CustomerService,
    ID,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { CouponService } from './coupon.service';
import { CouponTemplate } from './coupon-template.entity';
import { CustomerCoupon } from './customer-coupon.entity';
import { CouponSaleOrder } from './coupon-sale-order.entity';
import { CouponBundle, CouponBundleItem } from './coupon-bundle.entity';
import {
    expandBundleItems,
    filterSaleCatalogue,
    isSaleOrderRefundable,
} from './coupon-sale';
import { filterTemplatesByChannelAndScene, hasChannel, matchesScene } from './coupon-channel';
import { getCouponBalancePort } from './coupon-balance-port';
import { WechatpayService, resolveCustomerOpenid } from '@vendure/wechatpay-plugin';

/**
 * 进程内网关引用（镜像 recharge-card-plugin 的 setWechatpayGateway 模式）：
 * 由 plugin.ts 在启动时经 Injector 取到 WechatpayService 后 setCouponSaleGateway 注入；
 * 未装载 WechatpayPlugin 时为 null，微信支付入口提示网关未配置。
 */
let gatewayService: WechatpayService | null = null;
export function setCouponSaleGateway(gw: WechatpayService | null): void {
    gatewayService = gw;
}

/**
 * 出售链路编排：独立券商城（微信 / 余额）+ 加价购 + 退款回收。
 * 所有金额单位为「分」。订单/券的最终发放在 CouponService 内完成，本服务只做编排与状态机。
 */
@Injectable()
export class CouponSaleService {
    constructor(
        private connection: TransactionalConnection,
        private couponService: CouponService,
        private customerService: CustomerService,
    ) {}

    /** 当前请求的 customerId */
    private async currentCustomerId(ctx: RequestContext): Promise<number> {
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId!);
        if (!customer) {
            throw new UserInputError('No customer for the current user');
        }
        return customer.id as number;
    }

    /** 券商城目录：可售模板（渠道含 SALE 且 salePrice>0）+ 启用券包 */
    async saleCatalogue(
        ctx: RequestContext,
        scene?: string,
    ): Promise<{ templates: CouponTemplate[]; bundles: CouponBundle[] }> {
        const repo = this.connection.getRepository(ctx, CouponTemplate);
        const all = await repo.find({ relations: { channels: true } });
        const effectiveScene = (scene ?? 'ONLINE') as any;
        const saleable = filterSaleCatalogue(
            filterTemplatesByChannelAndScene(all, 'SALE', effectiveScene),
        ).filter(t => t.enabled);

        const bundleRepo = this.connection.getRepository(ctx, CouponBundle);
        const bundles = await bundleRepo.find({
            where: { enabled: true, channelId: ctx.channelId as any },
            order: { id: 'DESC' },
        });
        return { templates: saleable, bundles };
    }

    /** 创建出售单（路径 A）：校验渠道含 SALE / 可售 / 未售罄，落 PENDING 单 */
    async createSaleOrder(
        ctx: RequestContext,
        templateId?: ID | null,
        bundleId?: ID | null,
    ): Promise<CouponSaleOrder> {
        if (!templateId && !bundleId) {
            throw new UserInputError('templateId or bundleId is required');
        }
        if (templateId && bundleId) {
            throw new UserInputError('Only one of templateId / bundleId is allowed');
        }
        const customerId = await this.currentCustomerId(ctx);
        let amount = 0;
        if (templateId) {
            const tpl = await this.loadSaleableTemplate(ctx, templateId);
            amount = tpl.salePrice;
        } else {
            const { bundle, items } = await this.loadSaleableBundle(ctx, bundleId as ID);
            this.assertBundleStock(items);
            amount = bundle.salePrice;
        }
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        return repo.save(
            new CouponSaleOrder({
                customerId,
                payMode: 'WECHAT',
                templateId: templateId ? Number(templateId) : null,
                bundleId: bundleId ? Number(bundleId) : null,
                orderId: null,
                surchargeId: null,
                amount,
                status: 'PENDING',
                paymentMethod: null,
                externalRef: null,
                remark: null,
                channelId: ctx.channelId as number,
            }),
        );
    }

    /** 余额支付（同步结算）：扣余额 → 置 PAID → 发券 */
    async paySaleOrderWithBalance(ctx: RequestContext, id: ID): Promise<CouponSaleOrder> {
        const port = getCouponBalancePort();
        if (!port) {
            throw new UserInputError('Balance payment is not available');
        }
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        const order = await this.loadOwnedPendingOrder(ctx, id);
        await port.deductBalance(ctx, order.customerId, order.amount);
        order.paymentMethod = 'balance';
        await repo.save(order);
        await this.settleSaleOrder(ctx, order.id as number);
        const fresh = await repo.findOne({ where: { id: order.id } });
        return fresh as CouponSaleOrder;
    }

    /** 生成微信支付参数（仅本人 PENDING 单），镜像 recharge-card 的 RC- 范式 */
    async createWechatCouponPayment(
        ctx: RequestContext,
        saleOrderId: ID,
        tradeType?: 'JSAPI' | 'NATIVE' | 'H5' | 'APP',
        openid?: string,
    ): Promise<any> {
        const order = await this.loadOwnedPendingOrder(ctx, saleOrderId);
        if (!gatewayService) {
            throw new UserInputError('Payment gateway not configured');
        }
        const outTradeNo = `CS-${order.id}`;
        const effectiveTradeType = tradeType || 'JSAPI';
        const effectiveOpenid =
            openid ||
            (await resolveCustomerOpenid(ctx, order.customerId, {
                preferMini: effectiveTradeType === 'JSAPI',
            }));
        const pay = await gatewayService.createBarePayment({
            outTradeNo,
            amount: order.amount,
            tradeType: effectiveTradeType,
            openid: effectiveOpenid,
            description: `Coupon ${outTradeNo}`,
        });
        order.paymentMethod = 'wechatpay';
        order.externalRef = outTradeNo;
        await this.connection.getRepository(ctx, CouponSaleOrder).save(order);
        return { saleOrderId: order.id, outTradeNo, pay };
    }

    /** 微信回调结算入口：解析 CS-<id>，原子置 PAID 后发券（幂等） */
    async settleCouponSaleOrderByOutTradeNo(ctx: RequestContext, outTradeNo: string): Promise<void> {
        const m = String(outTradeNo).match(/^CS-(\d+)$/);
        if (!m) {
            throw new UserInputError('Invalid coupon sale out_trade_no');
        }
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        const order = await repo.findOne({
            where: { id: m[1] as any, channelId: ctx.channelId as any },
        });
        if (!order) {
            throw new UserInputError('Coupon sale order not found');
        }
        if (order.status !== 'PENDING') {
            return; // 幂等：已结算直接返回
        }
        await this.connection.startTransaction(ctx);
        try {
            const claim = await repo
                .createQueryBuilder()
                .update(CouponSaleOrder)
                .set({ status: 'PAID', paidAt: new Date() })
                .where('id = :id AND status = :status', { id: order.id, status: 'PENDING' })
                .execute();
            if ((claim.affected ?? 0) === 0) {
                await this.connection.commitOpenTransaction(ctx);
                return; // 并发下已被他人结算
            }
            await this.issueCouponsForOrder(ctx, order);
            await this.connection.commitOpenTransaction(ctx);
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    /** 取消未支付出售单 */
    async cancelSaleOrder(ctx: RequestContext, id: ID): Promise<CouponSaleOrder> {
        const order = await this.loadOwnedPendingOrder(ctx, id);
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        order.status = 'CANCELLED';
        return repo.save(order);
    }

    /**
     * 退款回收（路径 A：微信 / 余额）：券全部未使用才可退。
     * 回收券（INVALID）+ 单据 REFUNDED + 余额补偿（微信/余额支付均已入客户余额，见 §16-2 决策）。
     */
    async refundSaleOrder(ctx: RequestContext, id: ID, reason?: string): Promise<CouponSaleOrder> {
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        const order = await repo.findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        if (!order) {
            throw new UserInputError('Coupon sale order not found');
        }
        if (order.payMode === 'ORDER_SURCHARGE') {
            throw new UserInputError('Please refund the main order instead');
        }
        if (order.status !== 'PAID') {
            throw new UserInputError(`Coupon sale order is ${order.status}`);
        }
        const coupons = await this.loadSaleCoupons(ctx, order.id as number);
        if (!isSaleOrderRefundable(coupons.map(c => c.status))) {
            throw new UserInputError('Coupon already used, refund rejected');
        }
        const port = getCouponBalancePort();
        if (!port) {
            throw new UserInputError('Balance refund is not available');
        }
        await this.connection.startTransaction(ctx);
        try {
            const claim = await repo
                .createQueryBuilder()
                .update(CouponSaleOrder)
                .set({ status: 'REFUNDED', refundedAt: new Date(), remark: reason ?? order.remark })
                .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                .execute();
            if ((claim.affected ?? 0) === 0) {
                throw new UserInputError('Coupon sale order is not refundable now');
            }
            await this.invalidateCoupons(ctx, order.id as number);
            await port.addBalance(ctx, order.customerId, order.amount);
            await this.connection.commitOpenTransaction(ctx);
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
        return (await repo.findOne({ where: { id: order.id } })) as CouponSaleOrder;
    }

    /** 我的出售单 */
    async mySaleOrders(ctx: RequestContext): Promise<CouponSaleOrder[]> {
        const customerId = await this.currentCustomerId(ctx);
        return this.connection.getRepository(ctx, CouponSaleOrder).find({
            where: { customerId, channelId: ctx.channelId as any },
            order: { id: 'DESC' },
        });
    }

    // ===== 加价购（路径 B）=====

    /**
     * 商品页加价购：把券价作为 Surcharge 挂到主订单，落 PENDING 出售单。
     * orderId 必须是本人的活动订单。同一 orderId + templateId 只允许一条 PENDING。
     */
    async attachCouponToOrder(
        ctx: RequestContext,
        orderId: ID,
        templateId: ID,
        orderService: any,
    ): Promise<CouponSaleOrder> {
        const customerId = await this.currentCustomerId(ctx);
        const tpl = await this.loadSaleableTemplate(ctx, templateId);
        if (!matchesScene(tpl.usageScene, 'ONLINE')) {
            throw new UserInputError('Coupon is not available for online orders');
        }
        const order = await orderService.getOrderOrThrow(ctx, orderId);
        const orderCustomerId = order.customer?.id ?? order.customerId;
        if (String(orderCustomerId) !== String(customerId)) {
            throw new UserInputError('Order does not belong to the current customer');
        }
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        const existing = await repo.findOne({
            where: {
                orderId: Number(orderId),
                templateId: Number(templateId),
                status: 'PENDING',
                channelId: ctx.channelId as any,
            },
        });
        if (existing) {
            throw new UserInputError('Coupon already attached to this order');
        }
        const updated = await orderService.addSurchargeToOrder(ctx, orderId, {
            description: `Coupon surcharge #${templateId}`,
            listPrice: tpl.salePrice,
            listPriceIncludesTax: ctx.channel.pricesIncludeTax,
        });
        const surcharge = updated.surcharges[updated.surcharges.length - 1];
        return repo.save(
            new CouponSaleOrder({
                customerId,
                payMode: 'ORDER_SURCHARGE',
                templateId: Number(templateId),
                bundleId: null,
                orderId: Number(orderId),
                surchargeId: surcharge ? Number(surcharge.id) : null,
                amount: tpl.salePrice,
                status: 'PENDING',
                paymentMethod: null,
                externalRef: null,
                remark: null,
                channelId: ctx.channelId as number,
            }),
        );
    }

    /** 摘除加价购：移除 Surcharge + 置 CANCELLED */
    async detachCouponFromOrder(
        ctx: RequestContext,
        orderId: ID,
        templateId: ID,
        orderService: any,
    ): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        const order = await repo.findOne({
            where: {
                orderId: Number(orderId),
                templateId: Number(templateId),
                status: 'PENDING',
                channelId: ctx.channelId as any,
            },
        });
        if (!order) {
            return false;
        }
        if (order.surchargeId != null) {
            await orderService.removeSurchargeFromOrder(ctx, orderId, order.surchargeId);
        }
        order.status = 'CANCELLED';
        await repo.save(order);
        return true;
    }

    /**
     * 主订单支付成功 → 结算全部 PENDING 加价购单（幂等）。
     * 由 plugin.ts 订阅 OrderStateTransitionEvent(toState='PaymentSettled') 调用。
     */
    async settleSurchargeOrdersForOrder(ctx: RequestContext, orderId: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        const orders = await repo.find({
            where: {
                orderId: Number(orderId),
                payMode: 'ORDER_SURCHARGE',
                status: 'PENDING',
            },
        });
        for (const order of orders) {
            await this.settleSaleOrderWithTx(ctx, order);
        }
    }

    /**
     * 主订单整单退款/取消 → 回收加价购券并置 REFUNDED（钱随主订单退回，不做余额补偿）。
     */
    async refundSurchargeOrdersForOrder(ctx: RequestContext, orderId: ID): Promise<void> {
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        const orders = await repo.find({
            where: {
                orderId: Number(orderId),
                payMode: 'ORDER_SURCHARGE',
                status: 'PAID',
            },
        });
        for (const order of orders) {
            await this.connection.startTransaction(ctx);
            try {
                const claim = await repo
                    .createQueryBuilder()
                    .update(CouponSaleOrder)
                    .set({ status: 'REFUNDED', refundedAt: new Date() })
                    .where('id = :id AND status = :status', { id: order.id, status: 'PAID' })
                    .execute();
                if ((claim.affected ?? 0) === 0) {
                    await this.connection.commitOpenTransaction(ctx);
                    continue;
                }
                await this.invalidateCoupons(ctx, order.id as number);
                await this.connection.commitOpenTransaction(ctx);
            } catch (e) {
                await this.connection.rollBackTransaction(ctx);
                throw e;
            }
        }
    }

    // ===== 券包（admin + 购买编排）=====

    async listBundles(
        ctx: RequestContext,
        options?: { skip?: number; take?: number },
    ): Promise<{ items: CouponBundle[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, CouponBundle)
            .createQueryBuilder('b')
            .where('b.channelId = :channelId', { channelId: Number(ctx.channelId) });
        qb.orderBy('b.id', 'DESC');
        qb.skip(Math.max(0, options?.skip ?? 0)).take(Math.min(options?.take ?? 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findBundle(ctx: RequestContext, id: ID): Promise<CouponBundle | undefined> {
        const found = await this.connection.getRepository(ctx, CouponBundle).findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        return found ?? undefined;
    }

    async listBundleItems(ctx: RequestContext, bundleId: ID): Promise<CouponBundleItem[]> {
        return this.connection.getRepository(ctx, CouponBundleItem).find({
            where: { bundleId: Number(bundleId) },
            order: { id: 'ASC' },
        });
    }

    /** 创建/更新券包（仅管理当前渠道） */
    async saveBundle(ctx: RequestContext, input: any, id?: ID): Promise<CouponBundle> {
        const repo = this.connection.getRepository(ctx, CouponBundle);
        const bundle =
            id != null
                ? await repo.findOne({ where: { id: id as any, channelId: ctx.channelId as any } })
                : new CouponBundle({ channelId: ctx.channelId as number });
        if (!bundle) {
            throw new UserInputError('Coupon bundle not found');
        }
        const salePrice = Math.floor(Number(input?.salePrice ?? 0));
        if (!Number.isFinite(salePrice) || salePrice <= 0) {
            throw new UserInputError('salePrice must be a positive integer (cents)');
        }
        bundle.name = input?.name ?? bundle.name;
        if (input?.description !== undefined) {
            bundle.description = input.description ?? undefined;
        }
        bundle.salePrice = salePrice;
        if (input?.enabled !== undefined) {
            bundle.enabled = !!input.enabled;
        }
        if (input?.shopId !== undefined) {
            bundle.shopId = input.shopId == null ? null : Number(input.shopId);
        }
        const saved = await repo.save(bundle);

        if (Array.isArray(input?.items)) {
            const itemRepo = this.connection.getRepository(ctx, CouponBundleItem);
            await itemRepo.delete({ bundleId: saved.id as number });
            for (const raw of input.items) {
                const templateId = Number(raw?.templateId);
                if (!Number.isFinite(templateId)) {
                    throw new UserInputError('items[].templateId is required');
                }
                const qty = Math.max(1, Math.floor(Number(raw?.quantity ?? 1)) || 1);
                await itemRepo.save(
                    new CouponBundleItem({ bundleId: saved.id as number, templateId, quantity: qty }),
                );
            }
        }
        return saved;
    }

    async deleteBundle(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, CouponBundle);
        const bundle = await repo.findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        if (!bundle) {
            return false;
        }
        await this.connection.getRepository(ctx, CouponBundleItem).delete({ bundleId: bundle.id as number });
        await repo.remove(bundle);
        return true;
    }

    /** admin 出售单流水（列表 + 单查） */
    async listSaleOrders(
        ctx: RequestContext,
        options?: { skip?: number; take?: number; status?: string },
    ): Promise<{ items: CouponSaleOrder[]; totalItems: number }> {
        const qb = this.connection
            .getRepository(ctx, CouponSaleOrder)
            .createQueryBuilder('s')
            .where('s.channelId = :channelId', { channelId: Number(ctx.channelId) });
        if (options?.status) {
            qb.andWhere('s.status = :status', { status: options.status });
        }
        qb.orderBy('s.id', 'DESC');
        qb.skip(Math.max(0, options?.skip ?? 0)).take(Math.min(options?.take ?? 20, 200));
        const [items, totalItems] = await qb.getManyAndCount();
        return { items, totalItems };
    }

    async findSaleOrder(ctx: RequestContext, id: ID): Promise<CouponSaleOrder | undefined> {
        const found = await this.connection.getRepository(ctx, CouponSaleOrder).findOne({
            where: { id: id as any, channelId: ctx.channelId as any },
        });
        return found ?? undefined;
    }

    // ===== 内部：加载与校验 =====

    private async loadSaleableTemplate(ctx: RequestContext, templateId: ID): Promise<CouponTemplate> {
        const tpl = await this.connection.getRepository(ctx, CouponTemplate).findOne({
            where: { id: templateId as any },
            relations: { channels: true },
        });
        if (!tpl) {
            throw new UserInputError(`CouponTemplate ${templateId} not found`);
        }
        if (!tpl.enabled) {
            throw new UserInputError('Coupon template is disabled');
        }
        if (!hasChannel(tpl, false, 'SALE')) {
            throw new UserInputError('Coupon is not for sale');
        }
        if (!this.couponService.templateBelongsToChannel(ctx, tpl)) {
            throw new UserInputError('Coupon is not available in this shop');
        }
        if (Number(tpl.salePrice ?? 0) <= 0) {
            throw new UserInputError('Coupon has no sale price');
        }
        if (tpl.totalCount > 0 && tpl.claimedCount >= tpl.totalCount) {
            throw new UserInputError('Coupon sold out');
        }
        return tpl;
    }

    private async loadSaleableBundle(
        ctx: RequestContext,
        bundleId: ID,
    ): Promise<{ bundle: CouponBundle; items: CouponBundleItem[] }> {
        const bundle = await this.findBundle(ctx, bundleId);
        if (!bundle || !bundle.enabled) {
            throw new UserInputError('Coupon bundle not found');
        }
        if (Number(bundle.salePrice ?? 0) <= 0) {
            throw new UserInputError('Coupon bundle has no sale price');
        }
        const items = await this.listBundleItems(ctx, bundleId);
        if (items.length === 0) {
            throw new UserInputError('Coupon bundle is empty');
        }
        return { bundle, items };
    }

    private async assertBundleStock(items: CouponBundleItem[]): Promise<void> {
        // 无法 bundle 内模板一次性带 ctx 精查（省 IO 由发券时的原子扣减兜底），此处仅确认模板存在且启用
        const repo = this.connection.rawConnection.getRepository(CouponTemplate);
        for (const item of items) {
            const tpl = await repo.findOne({ where: { id: item.templateId as any } });
            if (!tpl || !tpl.enabled) {
                throw new UserInputError(`Bundle template ${item.templateId} is not available`);
            }
        }
    }

    private async loadOwnedPendingOrder(ctx: RequestContext, id: ID): Promise<CouponSaleOrder> {
        const customerId = await this.currentCustomerId(ctx);
        const order = await this.connection.getRepository(ctx, CouponSaleOrder).findOne({
            where: { id: id as any, customerId, channelId: ctx.channelId as any },
        });
        if (!order) {
            throw new UserInputError('Coupon sale order not found');
        }
        if (order.status !== 'PENDING') {
            throw new UserInputError(`Coupon sale order is ${order.status}`);
        }
        return order;
    }

    private async loadSaleCoupons(ctx: RequestContext, saleOrderId: number): Promise<CustomerCoupon[]> {
        return this.connection.getRepository(ctx, CustomerCoupon).find({
            where: { saleOrderId },
            order: { id: 'ASC' },
        });
    }

    /** 结算 + 发券（自带事务；供余额支付与加价购复用） */
    private async settleSaleOrderWithTx(ctx: RequestContext, order: CouponSaleOrder): Promise<void> {
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        await this.connection.startTransaction(ctx);
        try {
            const claim = await repo
                .createQueryBuilder()
                .update(CouponSaleOrder)
                .set({ status: 'PAID', paidAt: new Date() })
                .where('id = :id AND status = :status', { id: order.id, status: 'PENDING' })
                .execute();
            if ((claim.affected ?? 0) === 0) {
                await this.connection.commitOpenTransaction(ctx);
                return;
            }
            await this.issueCouponsForOrder(ctx, order);
            await this.connection.commitOpenTransaction(ctx);
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
    }

    /** 余额支付：已在事务内的结算（避免嵌套问题，直接发券） */
    private async settleSaleOrder(ctx: RequestContext, saleOrderId: number): Promise<void> {
        const repo = this.connection.getRepository(ctx, CouponSaleOrder);
        const order = await repo.findOne({ where: { id: saleOrderId as any } });
        if (!order) {
            throw new UserInputError('Coupon sale order not found');
        }
        await this.issueCouponsForOrder(ctx, order);
        order.status = 'PAID';
        order.paidAt = order.paidAt ?? new Date();
        await repo.save(order);
    }

    /** 按出售单发券：单券 1 张 / 券包按 item 展开逐张签发 */
    private async issueCouponsForOrder(ctx: RequestContext, order: CouponSaleOrder): Promise<void> {
        if (order.templateId != null) {
            const tpl = await this.connection.getRepository(ctx, CouponTemplate).findOne({
                where: { id: order.templateId as any },
            });
            if (!tpl) {
                throw new UserInputError(`CouponTemplate ${order.templateId} not found`);
            }
            await this.couponService.issueForSale(ctx, order.customerId, tpl, order.id as number);
            return;
        }
        if (order.bundleId != null) {
            const items = await this.listBundleItems(ctx, order.bundleId);
            const sequences = expandBundleItems(items);
            for (const templateId of sequences) {
                const tpl = await this.connection.getRepository(ctx, CouponTemplate).findOne({
                    where: { id: templateId as any },
                });
                if (!tpl) {
                    throw new UserInputError(`CouponTemplate ${templateId} not found`);
                }
                await this.couponService.issueForSale(ctx, order.customerId, tpl, order.id as number);
            }
            return;
        }
        throw new UserInputError('Coupon sale order has neither templateId nor bundleId');
    }

    private async invalidateCoupons(ctx: RequestContext, saleOrderId: number): Promise<void> {
        await this.connection
            .getRepository(ctx, CustomerCoupon)
            .createQueryBuilder()
            .update(CustomerCoupon)
            .set({ status: 'INVALID' })
            .where('saleOrderId = :saleOrderId AND status IN (:...statuses)', {
                saleOrderId,
                statuses: ['UNUSED', 'RETURNED', 'EXPIRED'],
            })
            .execute();
    }
}