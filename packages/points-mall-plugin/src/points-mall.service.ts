import { Injectable } from '@nestjs/common';
import {
    Address,
    ConfigService,
    Customer,
    ID,
    Logger,
    PaginatedList,
    ProductPriceApplicator,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';
import { Brackets, In, Not } from 'typeorm';
import { resolveCustomerOpenid } from '@vendure/wechatpay-plugin';
import { ProductFavorite } from './product-favorite.entity';
import { PointsOrder } from './points-order.entity';
import { PointsOrderPayment } from './points-order-payment.entity';
import { PointsProduct } from './points-product.entity';
import {
    CreatePointsOrderInput,
    CreatePointsProductInput,
    FavoriteProductView,
    PointsOrderListOptions,
    PointsPayParams,
    PointsProductListOptions,
    PointsProductView,
    ToggleFavoriteResult,
    UpdatePointsProductInput,
} from './types';

const loggerCtx = 'PointsMallService';

@Injectable()
export class PointsMallService {
    private memberLevel: any = null;
    private gateway: any = null;

    constructor(
        private connection: TransactionalConnection,
        private productPriceApplicator: ProductPriceApplicator,
        private configService: ConfigService,
    ) {}

    /** 与 AssetInterceptorPlugin 同源：用 assetStorageStrategy.toAbsoluteUrl 补绝对前缀。
     * C端 H5 为 history/hash 混合路由，裸 `preview/...` 相对路径会被解析到当前路由目录下导致图片 404。 */
    private toAbsoluteAssetUrl(ctx: RequestContext, preview: string | null | undefined): string {
        if (!preview) return '';
        const strategy = (this.configService?.assetOptions?.assetStorageStrategy ?? null) as any;
        if (strategy?.toAbsoluteUrl && ctx.req) {
            return strategy.toAbsoluteUrl(ctx.req, preview);
        }
        return preview;
    }

    setMemberLevelService(svc: any) {
        this.memberLevel = svc;
    }

    setWechatpayGateway(g: any) {
        this.gateway = g;
    }

    private async requireCustomer(ctx: RequestContext): Promise<Customer> {
        if (!ctx.activeUserId) throw new UserInputError('Login required');
        // Customer 无 userId 列，经 eager 的 user 关联定位（同 CustomerService.findOneByUserId 口径）
        const customer = await this.connection
            .getRepository(ctx, Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } as any });
        if (!customer) throw new UserInputError('Customer not found');
        return customer;
    }

    private async getVariantWithProduct(ctx: RequestContext, variantId: number) {
        const { ProductVariant } = require('@vendure/core');
        return this.connection.getRepository(ctx, ProductVariant).findOne({
            where: { id: variantId },
            relations: ['product', 'product.featuredAsset', 'product.translations', 'taxCategory'],
        });
    }

    /** 运行时填充变体价格（priceWithTax 为 @Calculated getter，需 listPrice/taxRateApplied 就位） */
    private async applyVariantPrices(ctx: RequestContext, variants: any[]): Promise<void> {
        await Promise.all(
            variants.filter(Boolean).map(v => this.productPriceApplicator.applyChannelPriceAndTax(v, ctx)),
        );
    }

    /** 批量取变体（含 product/featuredAsset/translations），返回 variantId → 变体 Map */
    private async getVariantsWithProduct(ctx: RequestContext, variantIds: number[]): Promise<Map<number, any>> {
        const map = new Map<number, any>();
        if (!variantIds.length) return map;
        const { ProductVariant } = require('@vendure/core');
        const variants: any[] = await this.connection
            .getRepository(ctx, ProductVariant)
            .find({
                where: { id: In(variantIds) } as any,
                relations: ['product', 'product.featuredAsset', 'product.translations', 'taxCategory'],
            });
        for (const v of variants) {
            map.set(Number(v.id), v);
        }
        return map;
    }

    /** 按语言取翻译，取不到退回第一条 */
    private pickTranslation(product: any, ctx: RequestContext): any {
        const translations = product?.translations ?? [];
        return translations.find((t: any) => t.languageCode === ctx.languageCode) ?? translations[0];
    }

    // ===== 商品收藏 =====

    /** 收藏切换：存在即删（favorited=false），否则插入（favorited=true）。resolver 端 @Transaction() 包裹。 */
    async toggleProductFavorite(ctx: RequestContext, productId: ID): Promise<ToggleFavoriteResult> {
        const customer = await this.requireCustomer(ctx);
        const pid = Number(productId);
        const favRepo = this.connection.getRepository(ctx, ProductFavorite);
        const existing = await favRepo.findOne({ where: { productId: pid, customerId: customer.id } as any });
        let favorited: boolean;
        if (existing) {
            await favRepo.remove(existing);
            favorited = false;
        } else {
            await favRepo.save({
                productId: pid,
                customerId: customer.id as number,
                channelId: ctx.channelId,
            } as any);
            favorited = true;
        }
        const favoriteCount = await favRepo.count({ where: { productId: pid } as any });
        Logger.info(`ProductFavorite product ${pid} toggled by customer ${customer.id} -> ${favorited}`, loggerCtx);
        return { favorited, favoriteCount };
    }

    /** 收藏元信息：总数 + 我是否已收藏（游客 myFavorited=false 不抛错）。 */
    async favoriteMeta(ctx: RequestContext, productId: ID): Promise<{ favoriteCount: number; myFavorited: boolean }> {
        const pid = Number(productId);
        const favRepo = this.connection.getRepository(ctx, ProductFavorite);
        const favoriteCount = await favRepo.count({ where: { productId: pid } as any });
        let myFavorited = false;
        if (ctx.activeUserId) {
            const customer = await this.connection
                .getRepository(ctx, Customer)
                .findOne({ where: { user: { id: ctx.activeUserId } } as any });
            if (customer) {
                myFavorited = !!(await favRepo.findOne({
                    where: { productId: pid, customerId: customer.id } as any,
                }));
            }
        }
        return { favoriteCount, myFavorited };
    }

    /** 我的收藏（渠道隔离，id 倒序），带商品视图与最低积分价；商品已删则给占位视图。 */
    async myFavorites(
        ctx: RequestContext,
        options?: PointsProductListOptions,
    ): Promise<{ items: FavoriteProductView[]; totalItems: number }> {
        const customer = await this.requireCustomer(ctx);
        const [favorites, totalItems] = await this.connection
            .getRepository(ctx, ProductFavorite)
            .createQueryBuilder('fav')
            .where('fav.customerId = :customerId', { customerId: customer.id })
            .andWhere('fav.channelId = :channelId', { channelId: ctx.channelId })
            .orderBy('fav.id', 'DESC')
            .skip(options?.skip)
            .take(options?.take ?? 20)
            .getManyAndCount();
        if (!favorites.length) {
            return { items: [], totalItems };
        }
        const productIds = [...new Set(favorites.map(f => f.productId))];
        const variants = await this.getFirstVariantsByProductIds(ctx, productIds);
        await this.applyVariantPrices(ctx, [...variants.values()]);
        const pool = await this.activePointsPool(ctx, productIds);
        const items: FavoriteProductView[] = [];
        for (const fav of favorites) {
            const variant = variants.get(fav.productId);
            const deleted = !variant || !!variant.product?.deletedAt;
            if (deleted) {
                items.push({
                    productId: String(fav.productId),
                    name: '已删除商品',
                    slug: '',
                    image: null,
                    priceWithTax: 0,
                    isOnSale: false,
                    pointsPrice: null,
                    favoritedAt: fav.favoritedAt,
                });
                continue;
            }
            const t = this.pickTranslation(variant.product, ctx);
            items.push({
                productId: String(fav.productId),
                name: t?.name ?? variant.name ?? '',
                slug: t?.slug ?? '',
                image: this.toAbsoluteAssetUrl(ctx, variant.product?.featuredAsset?.preview) || null,
                priceWithTax: variant.priceWithTax,
                isOnSale: variant.product?.enabled === true && !variant.deletedAt,
                pointsPrice: pool.get(fav.productId) ?? null,
                favoritedAt: fav.favoritedAt,
            });
        }
        return { items, totalItems };
    }

    /** 收藏视图批量取数：productId → 该商品下第一个变体（含 product 关联） */
    private async getFirstVariantsByProductIds(ctx: RequestContext, productIds: number[]): Promise<Map<number, any>> {
        const map = new Map<number, any>();
        if (!productIds.length) return map;
        const { ProductVariant } = require('@vendure/core');
        const variants: any[] = await this.connection
            .getRepository(ctx, ProductVariant)
            .find({
                where: { productId: In(productIds) } as any,
                relations: ['product', 'product.featuredAsset', 'product.translations', 'taxCategory'],
                order: { id: 'ASC' } as any,
            });
        for (const v of variants) {
            const pid = Number(v.productId);
            if (!map.has(pid)) map.set(pid, v);
        }
        return map;
    }

    /** 在售积分商品池：productId → 最低 pointsPrice */
    private async activePointsPool(ctx: RequestContext, productIds: number[]): Promise<Map<number, number>> {
        const map = new Map<number, number>();
        if (!productIds.length) return map;
        const rows = await this.connection.getRepository(ctx, PointsProduct).find({
            where: { productId: In(productIds), status: 'enabled', channelId: ctx.channelId } as any,
        });
        for (const r of rows) {
            const prev = map.get(r.productId);
            if (prev === undefined || r.pointsPrice < prev) {
                map.set(r.productId, r.pointsPrice);
            }
        }
        return map;
    }

    /** 登录客户对给定积分商品的已兑数量（非取消订单），customerId 为空返回空 Map */
    private async redeemedCountMap(
        ctx: RequestContext,
        pointsProductIds: number[],
        customerId: number | null,
    ): Promise<Map<number, number>> {
        const map = new Map<number, number>();
        if (!customerId || !pointsProductIds.length) return map;
        const rows: Array<{ pid: number; qty: string }> = await this.connection
            .getRepository(ctx, PointsOrder)
            .createQueryBuilder('po')
            .select('po.pointsProductId', 'pid')
            .addSelect('SUM(po.quantity)', 'qty')
            .where('po.customerId = :cid', { cid: customerId })
            .andWhere('po.pointsProductId IN (:...ids)', { ids: pointsProductIds })
            .andWhere("po.status != 'cancelled'")
            .groupBy('po.pointsProductId')
            .getRawMany();
        for (const r of rows) map.set(Number(r.pid), Number(r.qty) || 0);
        return map;
    }

    /** 静默解析当前客户主键（游客返回 null），供 myRedeemedCount 使用 */
    private async resolveOptionalCustomerId(ctx: RequestContext): Promise<number | null> {
        if (!ctx.activeUserId) return null;
        const customer = await this.connection
            .getRepository(ctx, Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } as any });
        return customer ? (customer.id as number) : null;
    }

    // ===== 积分商品（admin CRUD）=====

    private async assertVariantBelongsToProduct(ctx: RequestContext, productId: number, variantId: number): Promise<void> {
        const v = await this.getVariantWithProduct(ctx, variantId);
        if (!v || Number(v.productId) !== productId) {
            throw new UserInputError('Variant does not belong to product');
        }
    }

    async createPointsProduct(ctx: RequestContext, input: CreatePointsProductInput): Promise<PointsProduct> {
        const productId = Number(input.productId);
        const variantId = Number(input.variantId);
        await this.assertVariantBelongsToProduct(ctx, productId, variantId);
        const saved = (await this.connection.getRepository(ctx, PointsProduct).save({
            productId,
            variantId,
            pointsPrice: Math.floor(input.pointsPrice),
            cashPrice: Math.floor(input.cashPrice ?? 0),
            deliveryType: input.deliveryType === 'virtual' ? 'virtual' : 'physical',
            stock: Math.floor(input.stock),
            perUserLimit: Math.floor(input.perUserLimit ?? 0),
            redeemedCount: 0,
            validFrom: input.validFrom ?? null,
            validTo: input.validTo ?? null,
            status: input.status === 'disabled' ? 'disabled' : 'enabled',
            sortOrder: Math.floor(input.sortOrder ?? 0),
            channelId: ctx.channelId,
        } as any)) as PointsProduct;
        Logger.info(`PointsProduct ${saved.id} created for product ${productId}`, loggerCtx);
        return saved;
    }

    async updatePointsProduct(ctx: RequestContext, input: UpdatePointsProductInput): Promise<PointsProduct> {
        const repo = this.connection.getRepository(ctx, PointsProduct);
        const pp = await repo.findOne({ where: { id: Number(input.id), channelId: ctx.channelId } as any });
        if (!pp) throw new UserInputError('PointsProduct not found');
        if (input.productId != null || input.variantId != null) {
            const productId = input.productId != null ? Number(input.productId) : pp.productId;
            const variantId = input.variantId != null ? Number(input.variantId) : pp.variantId;
            await this.assertVariantBelongsToProduct(ctx, productId, variantId);
            pp.productId = productId;
            pp.variantId = variantId;
        }
        if (input.pointsPrice != null) pp.pointsPrice = Math.floor(input.pointsPrice);
        if (input.cashPrice != null) pp.cashPrice = Math.floor(input.cashPrice);
        if (input.deliveryType != null) pp.deliveryType = input.deliveryType === 'virtual' ? 'virtual' : 'physical';
        if (input.stock != null) pp.stock = Math.floor(input.stock);
        if (input.perUserLimit != null) pp.perUserLimit = Math.floor(input.perUserLimit);
        if (input.validFrom !== undefined) pp.validFrom = input.validFrom ?? null;
        if (input.validTo !== undefined) pp.validTo = input.validTo ?? null;
        if (input.status != null) pp.status = input.status === 'disabled' ? 'disabled' : 'enabled';
        if (input.sortOrder != null) pp.sortOrder = Math.floor(input.sortOrder);
        const saved = await repo.save(pp);
        Logger.info(`PointsProduct ${saved.id} updated`, loggerCtx);
        return saved;
    }

    async deletePointsProduct(ctx: RequestContext, id: ID): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, PointsProduct);
        const pp = await repo.findOne({ where: { id: Number(id), channelId: ctx.channelId } as any });
        if (!pp) return false;
        await repo.remove(pp);
        Logger.info(`PointsProduct ${pp.id} deleted`, loggerCtx);
        return true;
    }

    async adminPointsProducts(
        ctx: RequestContext,
        options?: PointsProductListOptions,
    ): Promise<PaginatedList<PointsProduct>> {
        const qb = this.connection
            .getRepository(ctx, PointsProduct)
            .createQueryBuilder('pp')
            .where('pp.channelId = :channelId', { channelId: ctx.channelId });
        const kw = options?.keyword?.trim();
        if (kw) {
            // 商品翻译名模糊 + 纯数字时 productId 精确（联表用表名+camelCase 带引号列）
            // 注意：product_translation 的外键列是 baseId（translation 实体 FK 命名），非 productId
            // AS TEXT 而非 AS CHAR：Postgres 下 CHAR 为 bpchar(1) 会截断；LIKE 仅为 Postgres 用 ILIKE（sqljs e2e 不支持）
            const LIKE = this.connection.rawConnection.options.type === 'postgres' ? 'ILIKE' : 'LIKE';
            qb.leftJoin('product_variant', 'v', 'v."id" = pp."variantId"')
                .leftJoin('product_translation', 'pt', 'pt."baseId" = v."productId"')
                .andWhere(`(pt."name" ${LIKE} :kw OR CAST(pp."productId" AS TEXT) = :kwExact)`, {
                    kw: `%${kw}%`,
                    kwExact: kw,
                });
        }
        const [items, totalItems] = await qb
            .orderBy('pp.sortOrder', 'ASC')
            .addOrderBy('pp.id', 'DESC')
            .skip(options?.skip)
            .take(options?.take ?? 50)
            .getManyAndCount();
        return { items, totalItems };
    }

    // ===== 积分商品（shop）=====

    /** 商城列表：enabled + 在有效期内，排序同 admin。 */
    async shopPointsProducts(
        ctx: RequestContext,
        options?: PointsProductListOptions,
    ): Promise<{ items: PointsProductView[]; totalItems: number }> {
        const now = new Date();
        const [rows, totalItems] = await this.connection
            .getRepository(ctx, PointsProduct)
            .createQueryBuilder('pp')
            .where('pp.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('pp.status = :status', { status: 'enabled' })
            .andWhere('(pp.validFrom IS NULL OR pp.validFrom <= :now)', { now })
            .andWhere('(pp.validTo IS NULL OR pp.validTo >= :now)', { now })
            .orderBy('pp.sortOrder', 'ASC')
            .addOrderBy('pp.id', 'DESC')
            .skip(options?.skip)
            .take(options?.take ?? 20)
            .getManyAndCount();
        const variants = await this.getVariantsWithProduct(ctx, rows.map(r => r.variantId));
        await this.applyVariantPrices(ctx, [...variants.values()]);
        const customerId = await this.resolveOptionalCustomerId(ctx);
        const redeemed = await this.redeemedCountMap(ctx, rows.map(r => Number(r.id)), customerId);
        return {
            items: rows.map(r => this.toView(ctx, r, variants.get(r.variantId), redeemed.get(Number(r.id)) ?? 0)),
            totalItems,
        };
    }

    /** 商城单条（enabled）。 */
    async shopPointsProduct(ctx: RequestContext, id: ID): Promise<PointsProductView | undefined> {
        const pp = await this.connection.getRepository(ctx, PointsProduct).findOne({
            where: { id: Number(id), channelId: ctx.channelId, status: 'enabled' } as any,
        });
        if (!pp) return undefined;
        const v = await this.getVariantWithProduct(ctx, pp.variantId);
        await this.applyVariantPrices(ctx, [v]);
        const customerId = await this.resolveOptionalCustomerId(ctx);
        const redeemed = await this.redeemedCountMap(ctx, [Number(pp.id)], customerId);
        return this.toView(ctx, pp, v ?? undefined, redeemed.get(Number(pp.id)) ?? 0);
    }

    private toView(ctx: RequestContext, r: PointsProduct, v?: any, myRedeemedCount = 0): PointsProductView {
        const product = v?.product;
        const t = this.pickTranslation(product, ctx);
        return {
            id: r.id,
            productId: r.productId,
            variantId: r.variantId,
            name: t?.name ?? v?.name ?? '',
            slug: t?.slug ?? '',
            image: this.toAbsoluteAssetUrl(ctx, product?.featuredAsset?.preview) || null,
            pointsPrice: r.pointsPrice,
            cashPrice: r.cashPrice,
            deliveryType: r.deliveryType,
            stock: r.stock,
            perUserLimit: r.perUserLimit,
            redeemedCount: r.redeemedCount,
            validFrom: r.validFrom,
            validTo: r.validTo,
            sortOrder: r.sortOrder,
            priceWithTax: v?.priceWithTax ?? 0,
            inStock: r.stock > 0,
            myRedeemedCount,
        };
    }

    // ===== 积分订单 =====

    private async loadPointsProductForOrder(ctx: RequestContext, id: number): Promise<PointsProduct> {
        // pessimistic_write：resolver @Transaction() 内执行，行锁使同商品并发下单串行，
        // assertBuyable 的 perUserLimit count 与后续扣库存不再有检查-写入窗口
        let pp: PointsProduct | null;
        try {
            pp = await this.connection.getRepository(ctx, PointsProduct).findOne({
                where: { id, channelId: ctx.channelId, status: 'enabled' } as any,
                lock: { mode: 'pessimistic_write' },
            });
        } catch {
            // sqljs 等 e2e 驱动不支持 SELECT FOR UPDATE，降级为普通读取
            pp = await this.connection.getRepository(ctx, PointsProduct).findOne({
                where: { id, channelId: ctx.channelId, status: 'enabled' } as any,
            });
        }
        if (!pp) throw new UserInputError('PointsProduct not found');
        return pp;
    }

    private async assertBuyable(ctx: RequestContext, pp: PointsProduct, quantity: number, customerId: number): Promise<void> {
        const now = new Date();
        if (pp.status !== 'enabled' || (pp.validFrom && pp.validFrom > now) || (pp.validTo && pp.validTo < now)) {
            throw new UserInputError('NOT_IN_VALIDITY');
        }
        if (pp.stock < quantity) {
            throw new UserInputError('OUT_OF_STOCK');
        }
        if (pp.perUserLimit > 0) {
            const used = await this.connection.getRepository(ctx, PointsOrder).count({
                where: { customerId, pointsProductId: pp.id, status: Not('cancelled') } as any,
            });
            if (used + quantity > pp.perUserLimit) {
                throw new UserInputError('PER_USER_LIMIT_EXCEEDED');
            }
        }
    }

    /** 积分兑换下单（resolver 端 @Transaction() 包裹）：扣分 → 原子扣库存 → 建单（code 回写）→ 混合价建支付单。 */
    async createPointsOrderExchange(ctx: RequestContext, input: CreatePointsOrderInput): Promise<PointsOrder> {
        if (!this.memberLevel) {
            throw new UserInputError('Member level service unavailable');
        }
        const customer = await this.requireCustomer(ctx);
        const pp = await this.loadPointsProductForOrder(ctx, Number(input.pointsProductId));
        const quantity = Math.floor(input.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new UserInputError('Invalid quantity');
        }
        await this.assertBuyable(ctx, pp, quantity, customer.id as number);

        let addressSnapshot: Record<string, any> | null = null;
        if (pp.deliveryType === 'physical') {
            if (!input.addressId) {
                throw new UserInputError('ADDRESS_REQUIRED');
            }
            const address = await this.connection.getRepository(ctx, Address).findOne({
                where: { id: Number(input.addressId), customer: { id: customer.id } } as any,
            });
            if (!address) {
                throw new UserInputError('Address not found');
            }
            addressSnapshot = {
                name: address.fullName || '',
                phone: address.phoneNumber || '',
                province: address.province || '',
                city: address.city || '',
                district: (address as any).district || '',
                detail: address.streetLine1 || '',
            };
        }

        const pointsTotal = pp.pointsPrice * quantity;
        const cashTotal = (pp.cashPrice ?? 0) * quantity;

        // 先扣积分（SPEND 流水），积分不足由 spendPoints 抛错中止
        await this.memberLevel.spendPoints(ctx, customer.id, pointsTotal, null, 'Points order exchange');

        // 原子扣库存（防并发超卖）
        const stockClaim = await this.connection
            .getRepository(ctx, PointsProduct)
            .createQueryBuilder()
            .update(PointsProduct)
            .set({ stock: () => `stock - ${quantity}`, redeemedCount: () => `redeemedCount + ${quantity}` })
            .where('id = :id AND stock >= :qty', { id: pp.id, qty: quantity })
            .execute();
        if (stockClaim.affected === 0) {
            throw new UserInputError('OUT_OF_STOCK');
        }

        const v = await this.getVariantWithProduct(ctx, pp.variantId);
        const t = this.pickTranslation(v?.product, ctx);
        const productSnapshot = {
            productId: pp.productId,
            variantId: pp.variantId,
            name: t?.name ?? v?.name ?? '',
            image: this.toAbsoluteAssetUrl(ctx, v?.product?.featuredAsset?.preview) || null,
            spec: v?.name ?? '',
        };

        const status = cashTotal > 0 ? 'pending_payment' : pp.deliveryType === 'virtual' ? 'completed' : 'pending_ship';
        const now = new Date();

        const repo = this.connection.getRepository(ctx, PointsOrder);
        const saved = (await repo.save({
            code: 'PO-TEMP',
            customerId: customer.id as number,
            pointsProductId: pp.id,
            productSnapshot,
            quantity,
            pointsTotal,
            cashTotal,
            deliveryType: pp.deliveryType,
            addressSnapshot,
            status,
            trackingNo: null,
            paidAt: status === 'completed' ? now : null,
            shippedAt: null,
            completedAt: status === 'completed' ? now : null,
            channelId: ctx.channelId,
        } as any)) as PointsOrder;
        const final = (await repo.save({ ...saved, code: `PO-${saved.id}` } as any)) as PointsOrder;

        if (cashTotal > 0) {
            await this.connection.getRepository(ctx, PointsOrderPayment).save({
                orderId: final.id as number,
                customerId: customer.id as number,
                amount: cashTotal,
                status: 'pending',
                externalRef: final.code,
                transactionId: null,
                paidAt: null,
                channelId: ctx.channelId,
            } as any);
        }

        Logger.info(
            `PointsOrder ${final.code} created by customer ${customer.id} (status=${status}, points=${pointsTotal}, cash=${cashTotal})`,
            loggerCtx,
        );
        return final;
    }

    /** 混合价现金支付：校验本人订单 + pending_payment，走微信网关裸支付参数。 */
    async createPointsOrderPayment(
        ctx: RequestContext,
        pointsOrderId: ID,
        tradeType?: string,
        openid?: string,
    ): Promise<PointsPayParams> {
        const customer = await this.requireCustomer(ctx);
        const order = await this.connection.getRepository(ctx, PointsOrder).findOne({
            where: { id: Number(pointsOrderId), customerId: customer.id, channelId: ctx.channelId } as any,
        });
        if (!order) throw new UserInputError('Points order not found');
        if (order.status !== 'pending_payment') {
            throw new UserInputError(`Points order is ${order.status}`);
        }
        if (!this.gateway) {
            throw new UserInputError('Payment gateway not configured');
        }
        const tt = tradeType || 'JSAPI';
        // openid 缺省时由客户档案推导（微信 unionid/openid 存储口径），推导失败返回 undefined
        const openId = openid || (await resolveCustomerOpenid(ctx, customer.id, { preferMini: tt === 'JSAPI' }));
        const pay = await this.gateway.createBarePayment(
            {
                outTradeNo: order.code,
                amount: order.cashTotal,
                tradeType: tt,
                openid: openId,
                description: 'Points ' + order.code,
            },
            ctx,
        );
        return { pointsOrderId: order.id as any, outTradeNo: order.code, pay };
    }

    /** 支付回调结算：按 outTradeNo（PO-<id>）幂等置为 paid → pending_ship/completed。 */
    async settlePointsOrderByOutTradeNo(ctx: RequestContext, outTradeNo: string): Promise<void> {
        const m = String(outTradeNo).match(/^PO-(\d+)$/);
        if (!m) throw new UserInputError('Invalid points out_trade_no');
        const repo = this.connection.getRepository(ctx, PointsOrder);
        const order = await repo.findOne({
            where: { id: m[1] as any, channelId: ctx.channelId as any },
        });
        if (!order) throw new UserInputError('Points order not found');
        if (order.status !== 'pending_payment') return; // 幂等：已结算直接返回
        const next = order.deliveryType === 'virtual' ? 'completed' : 'pending_ship';
        const now = new Date();
        await this.connection.startTransaction(ctx);
        try {
            // 原子抢占支付单（并发回调只成功一次）
            const claimPay = await this.connection
                .getRepository(ctx, PointsOrderPayment)
                .createQueryBuilder()
                .update(PointsOrderPayment)
                .set({ status: 'paid', paidAt: now })
                .where('orderId = :orderId AND status = :status', { orderId: order.id, status: 'pending' })
                .execute();
            if (claimPay.affected === 0) {
                await this.connection.commitOpenTransaction(ctx);
                return;
            }
            const claimOrder = await repo
                .createQueryBuilder()
                .update(PointsOrder)
                .set({ status: next, paidAt: now, completedAt: next === 'completed' ? now : null })
                .where('id = :id AND status = :status', { id: order.id, status: 'pending_payment' })
                .execute();
            if (claimOrder.affected === 0) {
                await this.connection.commitOpenTransaction(ctx);
                return;
            }
            await this.connection.commitOpenTransaction(ctx);
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
        Logger.info(`PointsOrder ${order.code} settled via ${outTradeNo} -> ${next}`, loggerCtx);
    }

    /** 原子取消一笔待支付单：claim 状态 → 退分 → 回补库存 → 支付单置 cancelled。调用方负责事务与归属校验。 */
    private async executeCancel(ctx: RequestContext, order: PointsOrder, reason: string): Promise<boolean> {
        const repo = this.connection.getRepository(ctx, PointsOrder);
        const claim = await repo
            .createQueryBuilder()
            .update(PointsOrder)
            .set({ status: 'cancelled' })
            .where('id = :id AND status = :status', { id: order.id, status: 'pending_payment' })
            .execute();
        if (claim.affected === 0) return false;
        if (this.memberLevel) {
            await this.memberLevel.addPoints(ctx, order.customerId, order.pointsTotal, order.id, reason);
        } else {
            Logger.warn(
                `PointsOrder ${order.code} cancelled but memberLevel unavailable, points NOT refunded`,
                loggerCtx,
            );
        }
        await this.connection
            .getRepository(ctx, PointsProduct)
            .createQueryBuilder()
            .update(PointsProduct)
            .set({ stock: () => `stock + ${order.quantity}`, redeemedCount: () => `redeemedCount - ${order.quantity}` })
            .where('id = :id', { id: order.pointsProductId })
            .execute();
        await this.connection
            .getRepository(ctx, PointsOrderPayment)
            .createQueryBuilder()
            .update(PointsOrderPayment)
            .set({ status: 'cancelled' })
            .where('orderId = :orderId AND status = :status', { orderId: order.id, status: 'pending' })
            .execute();
        return true;
    }

    /** 未支付取消：退积分 + 回补库存 + 支付单置 cancelled。 */
    async cancelPointsOrder(ctx: RequestContext, id: ID): Promise<PointsOrder> {
        if (!this.memberLevel) {
            throw new UserInputError('Member level service unavailable');
        }
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, PointsOrder);
        const order = await repo.findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId } as any,
        });
        if (!order) throw new UserInputError('Points order not found');
        if (order.status !== 'pending_payment') {
            throw new UserInputError('ORDER_NOT_CANCELLABLE');
        }
        await this.connection.startTransaction(ctx);
        try {
            const done = await this.executeCancel(ctx, order, `Points order ${order.code} cancel refund`);
            if (!done) {
                await this.connection.commitOpenTransaction(ctx);
                throw new UserInputError('ORDER_NOT_CANCELLABLE');
            }
            await this.connection.commitOpenTransaction(ctx);
        } catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
        Logger.info(
            `PointsOrder ${order.code} cancelled by customer ${customer.id}, refunded ${order.pointsTotal} points`,
            loggerCtx,
        );
        return { ...order, status: 'cancelled' };
    }

    /** 定时任务入口：取消 ctx 渠道内 createdAt < before 的待支付单，返回取消数量 */
    async cancelExpiredOrders(ctx: RequestContext, before: Date): Promise<number> {
        const repo = this.connection.getRepository(ctx, PointsOrder);
        const expired = await repo.find({
            where: { status: 'pending_payment', channelId: ctx.channelId } as any,
        });
        let count = 0;
        for (const order of expired) {
            if (order.createdAt >= before) continue;
            await this.connection.startTransaction(ctx);
            try {
                if (await this.executeCancel(ctx, order, `Points order ${order.code} timeout refund`)) {
                    count++;
                    Logger.info(
                        `PointsOrder ${order.code} expired-cancelled, refunded ${order.pointsTotal} points`,
                        loggerCtx,
                    );
                }
                await this.connection.commitOpenTransaction(ctx);
            } catch (e) {
                await this.connection.rollBackTransaction(ctx);
                Logger.error(`PointsOrder ${order.code} expire-cancel failed: ${String(e)}`, loggerCtx);
            }
        }
        return count;
    }

    // ===== 订单查询 =====

    async myPointsOrders(ctx: RequestContext, options?: PointsOrderListOptions): Promise<PaginatedList<PointsOrder>> {
        const customer = await this.requireCustomer(ctx);
        const qb = this.connection
            .getRepository(ctx, PointsOrder)
            .createQueryBuilder('po')
            .where('po.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('po.customerId = :customerId', { customerId: customer.id });
        if (options?.status) {
            qb.andWhere('po.status = :status', { status: options.status });
        }
        const [items, totalItems] = await qb
            .orderBy('po.id', 'DESC')
            .skip(options?.skip)
            .take(options?.take ?? 20)
            .getManyAndCount();
        return { items, totalItems };
    }

    async myPointsOrder(ctx: RequestContext, id: ID): Promise<PointsOrder | undefined> {
        const customer = await this.requireCustomer(ctx);
        return (
            (await this.connection.getRepository(ctx, PointsOrder).findOne({
                where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId } as any,
            })) ?? undefined
        );
    }

    async adminPointsOrders(ctx: RequestContext, options?: PointsOrderListOptions): Promise<PaginatedList<PointsOrder>> {
        const qb = this.connection
            .getRepository(ctx, PointsOrder)
            .createQueryBuilder('po')
            .where('po.channelId = :channelId', { channelId: ctx.channelId });
        if (options?.status) {
            qb.andWhere('po.status = :status', { status: options.status });
        }
        const kw = options?.keyword?.trim();
        if (kw) {
            // 单号模糊；纯数字时追加 PO-<id> 前缀精确与 customerId 精确
            const LIKE = this.connection.rawConnection.options.type === 'postgres' ? 'ILIKE' : 'LIKE';
            qb.andWhere(
                new Brackets(w => {
                    w.where(`po.code ${LIKE} :kw`, { kw: `%${kw}%` });
                    if (/^\d+$/.test(kw)) {
                        w.orWhere('po.code = :codeExact', { codeExact: 'PO-' + kw });
                        w.orWhere('po.customerId = :cid', { cid: Number(kw) });
                    }
                }),
            );
        }
        const [items, totalItems] = await qb
            .orderBy('po.id', 'DESC')
            .skip(options?.skip)
            .take(options?.take ?? 20)
            .getManyAndCount();
        return { items, totalItems };
    }

    // ===== admin 履约状态机 =====

    async markPointsOrderPaid(ctx: RequestContext, id: ID): Promise<PointsOrder> {
        return this.applyTransition(ctx, id, 'pending_payment', o => {
            const virtual = o.deliveryType === 'virtual';
            return {
                status: virtual ? 'completed' : 'pending_ship',
                paidAt: new Date(),
                ...(virtual ? { completedAt: new Date() } : {}),
            };
        });
    }

    async markPointsOrderShipped(ctx: RequestContext, id: ID, trackingNo?: string): Promise<PointsOrder> {
        return this.applyTransition(ctx, id, 'pending_ship', () => ({
            status: 'shipped',
            shippedAt: new Date(),
            trackingNo: trackingNo || null,
        }));
    }

    async markPointsOrderCompleted(ctx: RequestContext, id: ID): Promise<PointsOrder> {
        return this.applyTransition(ctx, id, 'shipped', () => ({
            status: 'completed',
            completedAt: new Date(),
        }));
    }

    private async applyTransition(
        ctx: RequestContext,
        id: ID,
        fromStatus: string,
        patchFn: (o: PointsOrder) => Partial<PointsOrder>,
    ): Promise<PointsOrder> {
        const repo = this.connection.getRepository(ctx, PointsOrder);
        const existing = await repo.findOne({ where: { id: Number(id), channelId: ctx.channelId } as any });
        if (!existing) throw new UserInputError('Points order not found');
        const patch = patchFn(existing);
        // 原子抢占：status 条件在 UPDATE 内，并发双击只成功一次
        const claim = await repo
            .createQueryBuilder()
            .update(PointsOrder)
            .set(patch)
            .where('id = :id AND status = :status AND channelId = :channelId', {
                id: existing.id,
                status: fromStatus,
                channelId: ctx.channelId,
            })
            .execute();
        if (claim.affected === 0) {
            throw new UserInputError(`Points order is ${existing.status}`);
        }
        Logger.info(`PointsOrder ${existing.code} ${fromStatus} -> ${patch.status}`, loggerCtx);
        return { ...existing, ...patch } as PointsOrder;
    }
}
