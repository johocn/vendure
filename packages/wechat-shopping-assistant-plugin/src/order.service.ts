import { Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
    Customer,
    Logger,
    Order,
    OrderService,
    PaymentMethod,
    Product,
    ProductVariant,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

import { loggerCtx } from './constants';

export interface OrderSelection {
    productId: string;
    quantity: number;
}

/** 下单落单收货地址（对话选址携带，含电话） */
export interface OrderShippingAddress {
    fullName?: string;
    phoneNumber?: string;
    streetLine1: string;
}

export type CreateOrderOutcome =
    | { status: 'ok'; order: Order; items: Array<{ title: string; quantity: number; price: number }> }
    | { status: 'out_of_stock'; title: string }
    | { status: 'no_variant'; title: string }
    | { status: 'error'; message: string };

/** 对话内展示的支付方式（渠道启用 + 后台配置展示名） */
export interface PaymentMethodOption {
    code: string;
    name: string;
}

/** 对话最多展示的支付方式数量（超出时联系客服到收银台选择） */
const PAYMENT_METHOD_LIMIT = 8;

/**
 * 微信对话下单：
 * 选品（productId）→ 解析渠道默认变体（最低价有货）→ 建 Order 绑顾客 → 加购物车 → ArrangingPayment。
 * 绑顾客走 orderService.addCustomerToOrder（同步更新内存实体，ArrangingPayment 的
 * customer 守卫可见；裸 repo update 只落库、守卫读不到）。支付通过返回的订单号跳 H5 收银台。
 */
@Injectable()
export class AssistantOrderService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
    ) {}

    async createOrder(
        ctx: RequestContext,
        customer: Customer,
        selections: OrderSelection[],
        address?: OrderShippingAddress,
    ): Promise<CreateOrderOutcome> {
        if (!selections.length) {
            return { status: 'error', message: '未选择商品' };
        }
        try {
            // 每个选品解析渠道默认变体；解析失败的跳过，全部失败则报错
            const variantPicks: Array<{ variant: ProductVariant; title: string; quantity: number }> = [];
            for (const sel of selections) {
                const pick = await this.resolveDefaultVariant(ctx, sel.productId, String(ctx.channelId ?? ''));
                if (!pick) {
                    return { status: 'no_variant', title: sel.productId };
                }
                variantPicks.push({ ...pick, quantity: sel.quantity });
            }

            const order = await this.orderService.create(ctx);
            await this.orderService.addCustomerToOrder(ctx, order, customer);
            // 标记无头单：marketplace 进程按 orderKind='assistant' 豁免逐行 shippingLineId 校验
            // （服务类商品无物流；campus orderKind='errand' 同款豁免先例）
            await this.orderService.updateCustomFields(ctx, order.id, { orderKind: 'assistant' } as any);

            const items: Array<{ title: string; quantity: number; price: number }> = [];
            for (const pick of variantPicks) {
                const result = await this.orderService.addItemToOrder(
                    ctx,
                    order.id,
                    pick.variant.id,
                    pick.quantity,
                );
                if ('errorCode' in result) {
                    if (result.errorCode === 'INSUFFICIENT_STOCK_ERROR') {
                        return { status: 'out_of_stock', title: pick.title };
                    }
                    return { status: 'error', message: result.message };
                }
                const line = result.lines.find(l => String(l.productVariant.id) === String(pick.variant.id));
                items.push({
                    title: pick.title,
                    quantity: pick.quantity,
                    price: line?.unitPrice ?? pick.variant.listPrice ?? 0,
                });
            }

            // 落收货地址（含电话）：对话选址后写入订单 shippingAddress；失败不阻塞下单
            if (address?.streetLine1) {
                try {
                    await this.orderService.setShippingAddress(ctx, order.id, {
                        fullName: address.fullName ?? '',
                        phoneNumber: address.phoneNumber ?? '',
                        streetLine1: address.streetLine1,
                        countryCode: 'CN',
                    } as any);
                    Logger.info(`Assistant order shipping address set: order=${order.id}`, loggerCtx);
                } catch (e: any) {
                    Logger.warn(`Assistant order setShippingAddress skipped: ${e?.message}`, loggerCtx);
                }
            }

            // 转入待支付（ArrangingPayment），由用户点击支付链接在 H5 收银台完成支付
            const arrangeResult = await this.orderService.transitionToState(ctx, order.id, 'ArrangingPayment');
            if ('errorCode' in arrangeResult) {
                // GraphQL 生成错误类的 message 是裸错误码，真实原因在 transitionError（如具体被哪个 process 拦截）
                const detail = (arrangeResult as any).transitionError || arrangeResult.message;
                Logger.warn(`Assistant order ArrangingPayment blocked: ${detail}`, loggerCtx);
                return { status: 'error', message: String(detail) };
            }

            const finalOrder = await this.orderService.findOne(ctx, order.id, ['lines']);
            return {
                status: 'ok',
                order: finalOrder ?? order,
                items: items.length
                    ? items
                    : (finalOrder?.lines ?? []).map(l => ({
                          title: l.productVariant.name,
                          quantity: l.quantity,
                          price: l.unitPrice,
                      })),
            };
        } catch (e) {
            Logger.error(`Assistant order creation failed: ${String(e)}`, loggerCtx);
            return { status: 'error', message: String((e as Error).message ?? e) };
        }
    }

    /**
     * 渠道当前启用的支付方式（按后台展示名去重，最多 8 个）。
     * 展示名取当前语言 → en → 首个翻译；未配置翻译时回退 code。
     */
    async listPaymentMethods(ctx: RequestContext): Promise<PaymentMethodOption[]> {
        const channelId = Number(ctx.channelId ?? 0);
        if (!channelId) return [];
        try {
            const methods = await this.connection
                .getRepository(ctx, PaymentMethod)
                .createQueryBuilder('pm')
                .leftJoinAndSelect('pm.translations', 't')
                .leftJoin('pm.channels', 'ch')
                .where('ch.id = :channelId', { channelId })
                .andWhere('pm.enabled = :enabled', { enabled: true })
                .orderBy('pm.id', 'ASC')
                .getMany();
            const options: PaymentMethodOption[] = [];
            const seen = new Set<string>();
            for (const pm of methods) {
                const name = this.paymentMethodName(pm, ctx.languageCode) || pm.code;
                if (seen.has(name)) continue;
                seen.add(name);
                options.push({ code: pm.code, name });
                if (options.length >= PAYMENT_METHOD_LIMIT) break;
            }
            return options;
        } catch (e) {
            Logger.warn(`Assistant list payment methods failed: ${String(e)}`, loggerCtx);
            return [];
        }
    }

    /** 支付方式展示名（当前语言 → en → 首个翻译） */
    private paymentMethodName(method: PaymentMethod, languageCode: string): string {
        const translations = method.translations ?? [];
        const pick =
            translations.find(t => t.languageCode === languageCode) ??
            translations.find(t => t.languageCode === 'en') ??
            translations[0];
        const name = (pick as any)?.name;
        if (typeof name === 'string') return name;
        if (name && typeof name === 'object') {
            return String(name[languageCode] ?? name.en ?? Object.values(name)[0] ?? '');
        }
        return '';
    }

    /**
     * 渠道默认变体：商品已发布 → 取该渠道有价格且启用、按价格升序的第一个变体。
     * 查询限定 channelId 匹配价格行，避免跨渠道下单。
     */
    private async resolveDefaultVariant(
        ctx: RequestContext,
        productId: string,
        channelId: string,
    ): Promise<{ variant: ProductVariant; title: string } | null> {
        const product = await this.connection.getRepository(ctx, Product).findOne({
            where: { id: productId as any, enabled: true, deletedAt: IsNull() },
            relations: {
                translations: true,
                variants: { translations: true, productVariantPrices: true },
            },
        });
        if (!product) return null;
        const productTitle = product.translations.find(t => t.languageCode === ctx.languageCode)?.name
            ?? product.translations[0]?.name
            ?? `商品#${productId}`;
        const candidates = (product.variants ?? [])
            .filter(v => v.enabled && !v.deletedAt)
            .map(v => ({
                variant: v,
                price:
                    v.productVariantPrices?.find(p => Number(p.channelId) === Number(channelId))?.price ?? 0,
            }))
            .filter(x => x.price > 0)
            .sort((a, b) => a.price - b.price);
        if (!candidates.length) return null;
        const variant = candidates[0].variant;
        const variantTitle = variant.translations.find(t => t.languageCode === ctx.languageCode)?.name
            ?? variant.translations[0]?.name
            ?? '';
        return { variant, title: variantTitle && variantTitle !== productTitle ? `${productTitle} ${variantTitle}` : productTitle };
    }
}
