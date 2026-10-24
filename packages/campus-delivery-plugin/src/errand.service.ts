import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
    ForbiddenError,
    ID,
    Injector,
    Order,
    OrderService,
    Product,
    ProductService,
    ProductVariant,
    ProductVariantService,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { CampusBuilding } from './campus-building.entity';
import { CampusFulfillmentConfig } from './campus-fulfillment-config.entity';
import { CampusZone } from './campus-zone.entity';
import { quoteDynamicBaseFee } from './shipping-calculator';

/** 0 元载体商品 SKU：幂等创建的查重键，C 端 addItemToOrder 用其 variantId 加购物车 */
export const ERRAND_BASE_SKU = 'CAMPUS-ERRAND-BASE';
export const ERRAND_BASE_SLUG = 'campus-errand-base';
/** 跑腿类型白名单（与发单页/调度统计口径一致） */
export const ERRAND_KINDS = ['pickup_express', 'bring_food', 'buy', 'other'];
/** 小费 surcharge 标识（幂等清理键：同单重复设置按此描述清旧补新，防重复计费） */
export const ERRAND_TIP_SURCHARGE_DESC = '跑腿小费';

/**
 * R5 跑腿单：两步式链路——
 * 1) admin 用 ensureErrandProduct 幂等建 0 元载体（SKU 查重入口）；
 * 2) C 端先 addItemToOrder(variantId)，再 campusSetErrandInfo 写 errand 标记 + 小费 surcharge。
 * 支付金额 = 商品(0) + shipping(campusErrandCalculator 按 zone.fee) + surcharge(tip)；
 * 分成按 shipping + tip 计算（surcharge 不进 order.shipping，无双算）。
 */
@Injectable()
export class ErrandService {
    constructor(
        private connection: TransactionalConnection,
        private orderService: OrderService,
        private moduleRef: ModuleRef,
    ) {}

    /** vendure Injector 需由 ModuleRef 构造（Nest 不直接提供 Injector 作为可注入项） */
    private get injector(): Injector {
        return new Injector(this.moduleRef);
    }

    /** 幂等创建 0 元载体：按 SKU 查 ProductVariant，已存在直接返回。
     * ProductVariant 有 product FK，必须走 ProductService/ProductVariantService 组合（禁裸 repo.save 单表）。 */
    async ensureErrandProduct(ctx: RequestContext): Promise<{ variantId: ID; sku: string; created: boolean }> {
        const existing = await this.connection
            .getRepository(ctx, ProductVariant)
            .findOne({ where: { sku: ERRAND_BASE_SKU } });
        if (existing) {
            return { variantId: existing.id, sku: ERRAND_BASE_SKU, created: false };
        }
        const productService = this.injector.get(ProductService);
        const variantService = this.injector.get(ProductVariantService);
        const product: Product = await productService.create(ctx, {
            translations: [{
                languageCode: ctx.languageCode, name: '校园跑腿服务',
                slug: ERRAND_BASE_SLUG, description: '跑腿单 0 元载体商品',
            }],
        } as any);
        const [variant] = await variantService.create(ctx, [
            {
                productId: product.id,
                sku: ERRAND_BASE_SKU,
                price: 0,
                translations: [{ languageCode: ctx.languageCode, name: '校园跑腿服务' }],
            },
        ] as any);
        return { variantId: variant.id, sku: ERRAND_BASE_SKU, created: true };
    }

    /**
     * C 端跑腿单第二步：写 errand customFields（标记 orderKind/R5 + 起止 + 小费），
     * tip>0 时给订单加小费 surcharge（listPrice=tip，含税口径）。
     */
    async setErrandInfo(
        ctx: RequestContext,
        input: { kind: string; fromText: string; toText: string; tip: number;
                 errandFrom?: string; note?: string; buildingId?: string; campusZone?: string },
    ) {
        if (!ctx.activeUserId) throw new ForbiddenError();
        const orderId = ctx.session?.activeOrderId;
        if (!orderId) throw new UserInputError('购物车为空');
        // kind 白名单：防任意字符串写入后调度/统计按未知类型走
        const kind = String(input.kind ?? '').trim();
        if (!ERRAND_KINDS.includes(kind)) throw new UserInputError('跑腿类型不合法');
        const fromText = String(input.fromText ?? '').trim();
        const toText = String(input.toText ?? '').trim();
        if (!fromText || !toText) throw new UserInputError('请填写跑腿起点和终点');
        const note = input.note == null ? null : String(input.note).trim();
        const errandFrom = input.errandFrom == null ? null : String(input.errandFrom).trim();
        // 文本长度上限（字段无长度约束，防超长文本撑爆库/前端渲染）
        if (fromText.length > 100 || toText.length > 100) throw new UserInputError('起点/终点不能超过 100 个字符');
        if (note && note.length > 200) throw new UserInputError('备注不能超过 200 个字符');
        if (errandFrom && errandFrom.length > 64) throw new UserInputError('来源单号不合法');
        if (!Number.isFinite(input.tip) || input.tip < 0) throw new UserInputError('小费金额不合法');
        const tip = Math.floor(input.tip);
        if (tip > 100_000_00) throw new UserInputError('小费金额过大');
        // 分区/楼栋归属校验：只允许本渠道的地址体系，防写入他店 ID 导致调度/计价串店
        let campusZone: string | null = input.campusZone == null ? null : String(input.campusZone).trim();
        let buildingId: string | null = input.buildingId == null ? null : String(input.buildingId).trim();
        let zone: CampusZone | null = null;
        if (campusZone) {
            zone = await this.connection.getRepository(ctx, CampusZone).findOne({
                where: { name: campusZone, channelId: ctx.channelId as any },
            });
            if (!zone) throw new UserInputError('跑腿分区不属于当前店铺');
        }
        if (buildingId) {
            const bid = Number(buildingId);
            if (!Number.isInteger(bid) || bid <= 0) throw new UserInputError('楼栋不合法');
            const building = await this.connection.getRepository(ctx, CampusBuilding).findOne({
                where: { id: bid as any, channelId: ctx.channelId as any },
            });
            if (!building) throw new UserInputError('楼栋不属于当前店铺');
            if (zone && Number(building.zoneId) !== Number(zone.id)) {
                throw new UserInputError('楼栋不属于所选分区');
            }
            buildingId = String(bid);
            if (!zone) {
                const buildingZone = await this.connection.getRepository(ctx, CampusZone).findOne({
                    where: { id: building.zoneId as any, channelId: ctx.channelId as any },
                });
                campusZone = buildingZone?.name ?? null;
            }
        }
        const order = await this.orderService.updateCustomFields(ctx, orderId, {
            orderKind: 'errand',
            fulfillmentRoute: 'R5',
            errandKind: kind,
            // R2 接力单：errandFrom 存原单号（campusR2Relay 反查键）；普通 R5 缺省落 A 点文字
            errandFrom: errandFrom ?? fromText,
            errandTo: toText,
            errandNote: note,
            tip,
            buildingId,
            campusZone,
        } as any);
        // 小费 surcharge 幂等：先清本单全部旧小费，再按新 tip 加一条（tip=0 只清不加），
        // 防止同单重复设置（改小费/改地址/重复提交）叠加多条 surcharge 重复计费
        const existing = await this.connection.getRepository(ctx, Order).findOne({
            where: { id: orderId as any },
            relations: ['surcharges'],
        });
        const oldTips = (existing?.surcharges ?? []).filter(x => x.description === ERRAND_TIP_SURCHARGE_DESC);
        for (const s of oldTips) {
            await this.orderService.removeSurchargeFromOrder(ctx, orderId as any, s.id as any);
        }
        if (tip > 0) {
            // 本 fork 无独立 SurchargeService，surcharge 原语在 OrderService.addSurchargeToOrder（service 层无权限校验，shop ctx 可用）
            try {
                await this.orderService.addSurchargeToOrder(ctx, orderId as any, {
                    description: ERRAND_TIP_SURCHARGE_DESC,
                    listPrice: tip,
                    listPriceIncludesTax: true,
                } as any);
            } catch (e) {
                // 先清后加非事务：新增失败时回补刚清掉的旧小费（尽力而为），避免用户已填小费静默丢失
                for (const s of oldTips) {
                    await this.orderService.addSurchargeToOrder(ctx, orderId as any, {
                        description: ERRAND_TIP_SURCHARGE_DESC,
                        listPrice: Number((s as any).listPrice ?? 0),
                        listPriceIncludesTax: true,
                    } as any).catch(() => undefined);
                }
                throw e;
            }
        }
        return order;
    }

    /** R5 发单页读起步价：起步价 + 当前时段/供需/倍率后的实时价格（null → 默认 200 分） */
    async getErrandBaseFee(ctx: RequestContext): Promise<number> {
        const cfg = await this.connection.getRepository(ctx, CampusFulfillmentConfig).findOne({
            where: { channelId: ctx.channelId as any },
        });
        const quote = await quoteDynamicBaseFee(
            this.connection,
            ctx.channelId as ID,
            cfg?.errandBaseFee ?? 200,
            cfg,
            'errand',
        );
        return quote.price;
    }
}
