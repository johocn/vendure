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
exports.PointsMallService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const wechatpay_plugin_1 = require("@vendure/wechatpay-plugin");
const product_favorite_entity_1 = require("./product-favorite.entity");
const points_order_entity_1 = require("./points-order.entity");
const points_order_payment_entity_1 = require("./points-order-payment.entity");
const points_product_entity_1 = require("./points-product.entity");
const loggerCtx = 'PointsMallService';
let PointsMallService = class PointsMallService {
    constructor(connection, productPriceApplicator, configService) {
        this.connection = connection;
        this.productPriceApplicator = productPriceApplicator;
        this.configService = configService;
        this.memberLevel = null;
        this.gateway = null;
    }
    /** 与 AssetInterceptorPlugin 同源：用 assetStorageStrategy.toAbsoluteUrl 补绝对前缀。
     * C端 H5 为 history/hash 混合路由，裸 `preview/...` 相对路径会被解析到当前路由目录下导致图片 404。 */
    toAbsoluteAssetUrl(ctx, preview) {
        var _a, _b, _c;
        if (!preview)
            return '';
        const strategy = ((_c = (_b = (_a = this.configService) === null || _a === void 0 ? void 0 : _a.assetOptions) === null || _b === void 0 ? void 0 : _b.assetStorageStrategy) !== null && _c !== void 0 ? _c : null);
        if ((strategy === null || strategy === void 0 ? void 0 : strategy.toAbsoluteUrl) && ctx.req) {
            return strategy.toAbsoluteUrl(ctx.req, preview);
        }
        return preview;
    }
    setMemberLevelService(svc) {
        this.memberLevel = svc;
    }
    setWechatpayGateway(g) {
        this.gateway = g;
    }
    async requireCustomer(ctx) {
        if (!ctx.activeUserId)
            throw new core_1.UserInputError('Login required');
        // Customer 无 userId 列，经 eager 的 user 关联定位（同 CustomerService.findOneByUserId 口径）
        const customer = await this.connection
            .getRepository(ctx, core_1.Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } });
        if (!customer)
            throw new core_1.UserInputError('Customer not found');
        return customer;
    }
    async getVariantWithProduct(ctx, variantId) {
        const { ProductVariant } = require('@vendure/core');
        return this.connection.getRepository(ctx, ProductVariant).findOne({
            where: { id: variantId },
            relations: ['product', 'product.featuredAsset', 'product.translations', 'taxCategory'],
        });
    }
    /** 运行时填充变体价格（priceWithTax 为 @Calculated getter，需 listPrice/taxRateApplied 就位） */
    async applyVariantPrices(ctx, variants) {
        await Promise.all(variants.filter(Boolean).map(v => this.productPriceApplicator.applyChannelPriceAndTax(v, ctx)));
    }
    /** 批量取变体（含 product/featuredAsset/translations），返回 variantId → 变体 Map */
    async getVariantsWithProduct(ctx, variantIds) {
        const map = new Map();
        if (!variantIds.length)
            return map;
        const { ProductVariant } = require('@vendure/core');
        const variants = await this.connection
            .getRepository(ctx, ProductVariant)
            .find({
            where: { id: (0, typeorm_1.In)(variantIds) },
            relations: ['product', 'product.featuredAsset', 'product.translations', 'taxCategory'],
        });
        for (const v of variants) {
            map.set(Number(v.id), v);
        }
        return map;
    }
    /** 按语言取翻译，取不到退回第一条 */
    pickTranslation(product, ctx) {
        var _a, _b;
        const translations = (_a = product === null || product === void 0 ? void 0 : product.translations) !== null && _a !== void 0 ? _a : [];
        return (_b = translations.find((t) => t.languageCode === ctx.languageCode)) !== null && _b !== void 0 ? _b : translations[0];
    }
    // ===== 商品收藏 =====
    /** 收藏切换：存在即删（favorited=false），否则插入（favorited=true）。resolver 端 @Transaction() 包裹。 */
    async toggleProductFavorite(ctx, productId) {
        const customer = await this.requireCustomer(ctx);
        const pid = Number(productId);
        const favRepo = this.connection.getRepository(ctx, product_favorite_entity_1.ProductFavorite);
        const existing = await favRepo.findOne({ where: { productId: pid, customerId: customer.id } });
        let favorited;
        if (existing) {
            await favRepo.remove(existing);
            favorited = false;
        }
        else {
            await favRepo.save({
                productId: pid,
                customerId: customer.id,
                channelId: ctx.channelId,
            });
            favorited = true;
        }
        const favoriteCount = await favRepo.count({ where: { productId: pid } });
        core_1.Logger.info(`ProductFavorite product ${pid} toggled by customer ${customer.id} -> ${favorited}`, loggerCtx);
        return { favorited, favoriteCount };
    }
    /** 收藏元信息：总数 + 我是否已收藏（游客 myFavorited=false 不抛错）。 */
    async favoriteMeta(ctx, productId) {
        const pid = Number(productId);
        const favRepo = this.connection.getRepository(ctx, product_favorite_entity_1.ProductFavorite);
        const favoriteCount = await favRepo.count({ where: { productId: pid } });
        let myFavorited = false;
        if (ctx.activeUserId) {
            const customer = await this.connection
                .getRepository(ctx, core_1.Customer)
                .findOne({ where: { user: { id: ctx.activeUserId } } });
            if (customer) {
                myFavorited = !!(await favRepo.findOne({
                    where: { productId: pid, customerId: customer.id },
                }));
            }
        }
        return { favoriteCount, myFavorited };
    }
    /** 我的收藏（渠道隔离，id 倒序），带商品视图与最低积分价；商品已删则给占位视图。 */
    async myFavorites(ctx, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const customer = await this.requireCustomer(ctx);
        const [favorites, totalItems] = await this.connection
            .getRepository(ctx, product_favorite_entity_1.ProductFavorite)
            .createQueryBuilder('fav')
            .where('fav.customerId = :customerId', { customerId: customer.id })
            .andWhere('fav.channelId = :channelId', { channelId: ctx.channelId })
            .orderBy('fav.id', 'DESC')
            .skip(options === null || options === void 0 ? void 0 : options.skip)
            .take((_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 20)
            .getManyAndCount();
        if (!favorites.length) {
            return { items: [], totalItems };
        }
        const productIds = [...new Set(favorites.map(f => f.productId))];
        const variants = await this.getFirstVariantsByProductIds(ctx, productIds);
        await this.applyVariantPrices(ctx, [...variants.values()]);
        const pool = await this.activePointsPool(ctx, productIds);
        const items = [];
        for (const fav of favorites) {
            const variant = variants.get(fav.productId);
            const deleted = !variant || !!((_b = variant.product) === null || _b === void 0 ? void 0 : _b.deletedAt);
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
                name: (_d = (_c = t === null || t === void 0 ? void 0 : t.name) !== null && _c !== void 0 ? _c : variant.name) !== null && _d !== void 0 ? _d : '',
                slug: (_e = t === null || t === void 0 ? void 0 : t.slug) !== null && _e !== void 0 ? _e : '',
                image: this.toAbsoluteAssetUrl(ctx, (_g = (_f = variant.product) === null || _f === void 0 ? void 0 : _f.featuredAsset) === null || _g === void 0 ? void 0 : _g.preview) || null,
                priceWithTax: variant.priceWithTax,
                isOnSale: ((_h = variant.product) === null || _h === void 0 ? void 0 : _h.enabled) === true && !variant.deletedAt,
                pointsPrice: (_j = pool.get(fav.productId)) !== null && _j !== void 0 ? _j : null,
                favoritedAt: fav.favoritedAt,
            });
        }
        return { items, totalItems };
    }
    /** 收藏视图批量取数：productId → 该商品下第一个变体（含 product 关联） */
    async getFirstVariantsByProductIds(ctx, productIds) {
        const map = new Map();
        if (!productIds.length)
            return map;
        const { ProductVariant } = require('@vendure/core');
        const variants = await this.connection
            .getRepository(ctx, ProductVariant)
            .find({
            where: { productId: (0, typeorm_1.In)(productIds) },
            relations: ['product', 'product.featuredAsset', 'product.translations', 'taxCategory'],
            order: { id: 'ASC' },
        });
        for (const v of variants) {
            const pid = Number(v.productId);
            if (!map.has(pid))
                map.set(pid, v);
        }
        return map;
    }
    /** 在售积分商品池：productId → 最低 pointsPrice */
    async activePointsPool(ctx, productIds) {
        const map = new Map();
        if (!productIds.length)
            return map;
        const rows = await this.connection.getRepository(ctx, points_product_entity_1.PointsProduct).find({
            where: { productId: (0, typeorm_1.In)(productIds), status: 'enabled', channelId: ctx.channelId },
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
    async redeemedCountMap(ctx, pointsProductIds, customerId) {
        const map = new Map();
        if (!customerId || !pointsProductIds.length)
            return map;
        const rows = await this.connection
            .getRepository(ctx, points_order_entity_1.PointsOrder)
            .createQueryBuilder('po')
            .select('po.pointsProductId', 'pid')
            .addSelect('SUM(po.quantity)', 'qty')
            .where('po.customerId = :cid', { cid: customerId })
            .andWhere('po.pointsProductId IN (:...ids)', { ids: pointsProductIds })
            .andWhere("po.status != 'cancelled'")
            .groupBy('po.pointsProductId')
            .getRawMany();
        for (const r of rows)
            map.set(Number(r.pid), Number(r.qty) || 0);
        return map;
    }
    /** 静默解析当前客户主键（游客返回 null），供 myRedeemedCount 使用 */
    async resolveOptionalCustomerId(ctx) {
        if (!ctx.activeUserId)
            return null;
        const customer = await this.connection
            .getRepository(ctx, core_1.Customer)
            .findOne({ where: { user: { id: ctx.activeUserId } } });
        return customer ? customer.id : null;
    }
    // ===== 积分商品（admin CRUD）=====
    async assertVariantBelongsToProduct(ctx, productId, variantId) {
        const v = await this.getVariantWithProduct(ctx, variantId);
        if (!v || Number(v.productId) !== productId) {
            throw new core_1.UserInputError('Variant does not belong to product');
        }
    }
    async createPointsProduct(ctx, input) {
        var _a, _b, _c, _d, _e;
        const productId = Number(input.productId);
        const variantId = Number(input.variantId);
        await this.assertVariantBelongsToProduct(ctx, productId, variantId);
        const saved = (await this.connection.getRepository(ctx, points_product_entity_1.PointsProduct).save({
            productId,
            variantId,
            pointsPrice: Math.floor(input.pointsPrice),
            cashPrice: Math.floor((_a = input.cashPrice) !== null && _a !== void 0 ? _a : 0),
            deliveryType: input.deliveryType === 'virtual' ? 'virtual' : 'physical',
            stock: Math.floor(input.stock),
            perUserLimit: Math.floor((_b = input.perUserLimit) !== null && _b !== void 0 ? _b : 0),
            redeemedCount: 0,
            validFrom: (_c = input.validFrom) !== null && _c !== void 0 ? _c : null,
            validTo: (_d = input.validTo) !== null && _d !== void 0 ? _d : null,
            status: input.status === 'disabled' ? 'disabled' : 'enabled',
            sortOrder: Math.floor((_e = input.sortOrder) !== null && _e !== void 0 ? _e : 0),
            channelId: ctx.channelId,
        }));
        core_1.Logger.info(`PointsProduct ${saved.id} created for product ${productId}`, loggerCtx);
        return saved;
    }
    async updatePointsProduct(ctx, input) {
        var _a, _b;
        const repo = this.connection.getRepository(ctx, points_product_entity_1.PointsProduct);
        const pp = await repo.findOne({ where: { id: Number(input.id), channelId: ctx.channelId } });
        if (!pp)
            throw new core_1.UserInputError('PointsProduct not found');
        if (input.productId != null || input.variantId != null) {
            const productId = input.productId != null ? Number(input.productId) : pp.productId;
            const variantId = input.variantId != null ? Number(input.variantId) : pp.variantId;
            await this.assertVariantBelongsToProduct(ctx, productId, variantId);
            pp.productId = productId;
            pp.variantId = variantId;
        }
        if (input.pointsPrice != null)
            pp.pointsPrice = Math.floor(input.pointsPrice);
        if (input.cashPrice != null)
            pp.cashPrice = Math.floor(input.cashPrice);
        if (input.deliveryType != null)
            pp.deliveryType = input.deliveryType === 'virtual' ? 'virtual' : 'physical';
        if (input.stock != null)
            pp.stock = Math.floor(input.stock);
        if (input.perUserLimit != null)
            pp.perUserLimit = Math.floor(input.perUserLimit);
        if (input.validFrom !== undefined)
            pp.validFrom = (_a = input.validFrom) !== null && _a !== void 0 ? _a : null;
        if (input.validTo !== undefined)
            pp.validTo = (_b = input.validTo) !== null && _b !== void 0 ? _b : null;
        if (input.status != null)
            pp.status = input.status === 'disabled' ? 'disabled' : 'enabled';
        if (input.sortOrder != null)
            pp.sortOrder = Math.floor(input.sortOrder);
        const saved = await repo.save(pp);
        core_1.Logger.info(`PointsProduct ${saved.id} updated`, loggerCtx);
        return saved;
    }
    async deletePointsProduct(ctx, id) {
        const repo = this.connection.getRepository(ctx, points_product_entity_1.PointsProduct);
        const pp = await repo.findOne({ where: { id: Number(id), channelId: ctx.channelId } });
        if (!pp)
            return false;
        await repo.remove(pp);
        core_1.Logger.info(`PointsProduct ${pp.id} deleted`, loggerCtx);
        return true;
    }
    async adminPointsProducts(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, points_product_entity_1.PointsProduct)
            .createQueryBuilder('pp')
            .where('pp.channelId = :channelId', { channelId: ctx.channelId });
        const kw = (_a = options === null || options === void 0 ? void 0 : options.keyword) === null || _a === void 0 ? void 0 : _a.trim();
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
            .skip(options === null || options === void 0 ? void 0 : options.skip)
            .take((_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 50)
            .getManyAndCount();
        return { items, totalItems };
    }
    // ===== 积分商品（shop）=====
    /** 商城列表：enabled + 在有效期内，排序同 admin。 */
    async shopPointsProducts(ctx, options) {
        var _a;
        const now = new Date();
        const [rows, totalItems] = await this.connection
            .getRepository(ctx, points_product_entity_1.PointsProduct)
            .createQueryBuilder('pp')
            .where('pp.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('pp.status = :status', { status: 'enabled' })
            .andWhere('(pp.validFrom IS NULL OR pp.validFrom <= :now)', { now })
            .andWhere('(pp.validTo IS NULL OR pp.validTo >= :now)', { now })
            .orderBy('pp.sortOrder', 'ASC')
            .addOrderBy('pp.id', 'DESC')
            .skip(options === null || options === void 0 ? void 0 : options.skip)
            .take((_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 20)
            .getManyAndCount();
        const variants = await this.getVariantsWithProduct(ctx, rows.map(r => r.variantId));
        await this.applyVariantPrices(ctx, [...variants.values()]);
        const customerId = await this.resolveOptionalCustomerId(ctx);
        const redeemed = await this.redeemedCountMap(ctx, rows.map(r => Number(r.id)), customerId);
        return {
            items: rows.map(r => { var _a; return this.toView(ctx, r, variants.get(r.variantId), (_a = redeemed.get(Number(r.id))) !== null && _a !== void 0 ? _a : 0); }),
            totalItems,
        };
    }
    /** 商城单条（enabled）。 */
    async shopPointsProduct(ctx, id) {
        var _a;
        const pp = await this.connection.getRepository(ctx, points_product_entity_1.PointsProduct).findOne({
            where: { id: Number(id), channelId: ctx.channelId, status: 'enabled' },
        });
        if (!pp)
            return undefined;
        const v = await this.getVariantWithProduct(ctx, pp.variantId);
        await this.applyVariantPrices(ctx, [v]);
        const customerId = await this.resolveOptionalCustomerId(ctx);
        const redeemed = await this.redeemedCountMap(ctx, [Number(pp.id)], customerId);
        return this.toView(ctx, pp, v !== null && v !== void 0 ? v : undefined, (_a = redeemed.get(Number(pp.id))) !== null && _a !== void 0 ? _a : 0);
    }
    toView(ctx, r, v, myRedeemedCount = 0) {
        var _a, _b, _c, _d, _e;
        const product = v === null || v === void 0 ? void 0 : v.product;
        const t = this.pickTranslation(product, ctx);
        return {
            id: r.id,
            productId: r.productId,
            variantId: r.variantId,
            name: (_b = (_a = t === null || t === void 0 ? void 0 : t.name) !== null && _a !== void 0 ? _a : v === null || v === void 0 ? void 0 : v.name) !== null && _b !== void 0 ? _b : '',
            slug: (_c = t === null || t === void 0 ? void 0 : t.slug) !== null && _c !== void 0 ? _c : '',
            image: this.toAbsoluteAssetUrl(ctx, (_d = product === null || product === void 0 ? void 0 : product.featuredAsset) === null || _d === void 0 ? void 0 : _d.preview) || null,
            pointsPrice: r.pointsPrice,
            cashPrice: r.cashPrice,
            deliveryType: r.deliveryType,
            stock: r.stock,
            perUserLimit: r.perUserLimit,
            redeemedCount: r.redeemedCount,
            validFrom: r.validFrom,
            validTo: r.validTo,
            sortOrder: r.sortOrder,
            priceWithTax: (_e = v === null || v === void 0 ? void 0 : v.priceWithTax) !== null && _e !== void 0 ? _e : 0,
            inStock: r.stock > 0,
            myRedeemedCount,
        };
    }
    // ===== 积分订单 =====
    async loadPointsProductForOrder(ctx, id) {
        // pessimistic_write：resolver @Transaction() 内执行，行锁使同商品并发下单串行，
        // assertBuyable 的 perUserLimit count 与后续扣库存不再有检查-写入窗口
        let pp;
        try {
            pp = await this.connection.getRepository(ctx, points_product_entity_1.PointsProduct).findOne({
                where: { id, channelId: ctx.channelId, status: 'enabled' },
                lock: { mode: 'pessimistic_write' },
            });
        }
        catch (_a) {
            // sqljs 等 e2e 驱动不支持 SELECT FOR UPDATE，降级为普通读取
            pp = await this.connection.getRepository(ctx, points_product_entity_1.PointsProduct).findOne({
                where: { id, channelId: ctx.channelId, status: 'enabled' },
            });
        }
        if (!pp)
            throw new core_1.UserInputError('PointsProduct not found');
        return pp;
    }
    async assertBuyable(ctx, pp, quantity, customerId) {
        const now = new Date();
        if (pp.status !== 'enabled' || (pp.validFrom && pp.validFrom > now) || (pp.validTo && pp.validTo < now)) {
            throw new core_1.UserInputError('NOT_IN_VALIDITY');
        }
        if (pp.stock < quantity) {
            throw new core_1.UserInputError('OUT_OF_STOCK');
        }
        if (pp.perUserLimit > 0) {
            const used = await this.connection.getRepository(ctx, points_order_entity_1.PointsOrder).count({
                where: { customerId, pointsProductId: pp.id, status: (0, typeorm_1.Not)('cancelled') },
            });
            if (used + quantity > pp.perUserLimit) {
                throw new core_1.UserInputError('PER_USER_LIMIT_EXCEEDED');
            }
        }
    }
    /** 积分兑换下单（resolver 端 @Transaction() 包裹）：扣分 → 原子扣库存 → 建单（code 回写）→ 混合价建支付单。 */
    async createPointsOrderExchange(ctx, input) {
        var _a, _b, _c, _d, _e, _f;
        if (!this.memberLevel) {
            throw new core_1.UserInputError('Member level service unavailable');
        }
        const customer = await this.requireCustomer(ctx);
        const pp = await this.loadPointsProductForOrder(ctx, Number(input.pointsProductId));
        const quantity = Math.floor(input.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new core_1.UserInputError('Invalid quantity');
        }
        await this.assertBuyable(ctx, pp, quantity, customer.id);
        let addressSnapshot = null;
        if (pp.deliveryType === 'physical') {
            if (!input.addressId) {
                throw new core_1.UserInputError('ADDRESS_REQUIRED');
            }
            const address = await this.connection.getRepository(ctx, core_1.Address).findOne({
                where: { id: Number(input.addressId), customer: { id: customer.id } },
            });
            if (!address) {
                throw new core_1.UserInputError('Address not found');
            }
            addressSnapshot = {
                name: address.fullName || '',
                phone: address.phoneNumber || '',
                province: address.province || '',
                city: address.city || '',
                district: address.district || '',
                detail: address.streetLine1 || '',
            };
        }
        const pointsTotal = pp.pointsPrice * quantity;
        const cashTotal = ((_a = pp.cashPrice) !== null && _a !== void 0 ? _a : 0) * quantity;
        // 先扣积分（SPEND 流水），积分不足由 spendPoints 抛错中止
        await this.memberLevel.spendPoints(ctx, customer.id, pointsTotal, null, 'Points order exchange');
        // 原子扣库存（防并发超卖）
        const stockClaim = await this.connection
            .getRepository(ctx, points_product_entity_1.PointsProduct)
            .createQueryBuilder()
            .update(points_product_entity_1.PointsProduct)
            .set({ stock: () => `stock - ${quantity}`, redeemedCount: () => `redeemedCount + ${quantity}` })
            .where('id = :id AND stock >= :qty', { id: pp.id, qty: quantity })
            .execute();
        if (stockClaim.affected === 0) {
            throw new core_1.UserInputError('OUT_OF_STOCK');
        }
        const v = await this.getVariantWithProduct(ctx, pp.variantId);
        const t = this.pickTranslation(v === null || v === void 0 ? void 0 : v.product, ctx);
        const productSnapshot = {
            productId: pp.productId,
            variantId: pp.variantId,
            name: (_c = (_b = t === null || t === void 0 ? void 0 : t.name) !== null && _b !== void 0 ? _b : v === null || v === void 0 ? void 0 : v.name) !== null && _c !== void 0 ? _c : '',
            image: this.toAbsoluteAssetUrl(ctx, (_e = (_d = v === null || v === void 0 ? void 0 : v.product) === null || _d === void 0 ? void 0 : _d.featuredAsset) === null || _e === void 0 ? void 0 : _e.preview) || null,
            spec: (_f = v === null || v === void 0 ? void 0 : v.name) !== null && _f !== void 0 ? _f : '',
        };
        const status = cashTotal > 0 ? 'pending_payment' : pp.deliveryType === 'virtual' ? 'completed' : 'pending_ship';
        const now = new Date();
        const repo = this.connection.getRepository(ctx, points_order_entity_1.PointsOrder);
        const saved = (await repo.save({
            code: 'PO-TEMP',
            customerId: customer.id,
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
        }));
        const final = (await repo.save(Object.assign(Object.assign({}, saved), { code: `PO-${saved.id}` })));
        if (cashTotal > 0) {
            await this.connection.getRepository(ctx, points_order_payment_entity_1.PointsOrderPayment).save({
                orderId: final.id,
                customerId: customer.id,
                amount: cashTotal,
                status: 'pending',
                externalRef: final.code,
                transactionId: null,
                paidAt: null,
                channelId: ctx.channelId,
            });
        }
        core_1.Logger.info(`PointsOrder ${final.code} created by customer ${customer.id} (status=${status}, points=${pointsTotal}, cash=${cashTotal})`, loggerCtx);
        return final;
    }
    /** 混合价现金支付：校验本人订单 + pending_payment，走微信网关裸支付参数。 */
    async createPointsOrderPayment(ctx, pointsOrderId, tradeType, openid) {
        const customer = await this.requireCustomer(ctx);
        const order = await this.connection.getRepository(ctx, points_order_entity_1.PointsOrder).findOne({
            where: { id: Number(pointsOrderId), customerId: customer.id, channelId: ctx.channelId },
        });
        if (!order)
            throw new core_1.UserInputError('Points order not found');
        if (order.status !== 'pending_payment') {
            throw new core_1.UserInputError(`Points order is ${order.status}`);
        }
        if (!this.gateway) {
            throw new core_1.UserInputError('Payment gateway not configured');
        }
        const tt = tradeType || 'JSAPI';
        // openid 缺省时由客户档案推导（微信 unionid/openid 存储口径），推导失败返回 undefined
        const openId = openid || (await (0, wechatpay_plugin_1.resolveCustomerOpenid)(ctx, customer.id, { preferMini: tt === 'JSAPI' }));
        const pay = await this.gateway.createBarePayment({
            outTradeNo: order.code,
            amount: order.cashTotal,
            tradeType: tt,
            openid: openId,
            description: 'Points ' + order.code,
        }, ctx);
        return { pointsOrderId: order.id, outTradeNo: order.code, pay };
    }
    /** 支付回调结算：按 outTradeNo（PO-<id>）幂等置为 paid → pending_ship/completed。 */
    async settlePointsOrderByOutTradeNo(ctx, outTradeNo) {
        const m = String(outTradeNo).match(/^PO-(\d+)$/);
        if (!m)
            throw new core_1.UserInputError('Invalid points out_trade_no');
        const repo = this.connection.getRepository(ctx, points_order_entity_1.PointsOrder);
        const order = await repo.findOne({
            where: { id: m[1], channelId: ctx.channelId },
        });
        if (!order)
            throw new core_1.UserInputError('Points order not found');
        if (order.status !== 'pending_payment')
            return; // 幂等：已结算直接返回
        const next = order.deliveryType === 'virtual' ? 'completed' : 'pending_ship';
        const now = new Date();
        await this.connection.startTransaction(ctx);
        try {
            // 原子抢占支付单（并发回调只成功一次）
            const claimPay = await this.connection
                .getRepository(ctx, points_order_payment_entity_1.PointsOrderPayment)
                .createQueryBuilder()
                .update(points_order_payment_entity_1.PointsOrderPayment)
                .set({ status: 'paid', paidAt: now })
                .where('orderId = :orderId AND status = :status', { orderId: order.id, status: 'pending' })
                .execute();
            if (claimPay.affected === 0) {
                await this.connection.commitOpenTransaction(ctx);
                return;
            }
            const claimOrder = await repo
                .createQueryBuilder()
                .update(points_order_entity_1.PointsOrder)
                .set({ status: next, paidAt: now, completedAt: next === 'completed' ? now : null })
                .where('id = :id AND status = :status', { id: order.id, status: 'pending_payment' })
                .execute();
            if (claimOrder.affected === 0) {
                await this.connection.commitOpenTransaction(ctx);
                return;
            }
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
        core_1.Logger.info(`PointsOrder ${order.code} settled via ${outTradeNo} -> ${next}`, loggerCtx);
    }
    /** 原子取消一笔待支付单：claim 状态 → 退分 → 回补库存 → 支付单置 cancelled。调用方负责事务与归属校验。 */
    async executeCancel(ctx, order, reason) {
        const repo = this.connection.getRepository(ctx, points_order_entity_1.PointsOrder);
        const claim = await repo
            .createQueryBuilder()
            .update(points_order_entity_1.PointsOrder)
            .set({ status: 'cancelled' })
            .where('id = :id AND status = :status', { id: order.id, status: 'pending_payment' })
            .execute();
        if (claim.affected === 0)
            return false;
        if (this.memberLevel) {
            await this.memberLevel.addPoints(ctx, order.customerId, order.pointsTotal, order.id, reason);
        }
        else {
            core_1.Logger.warn(`PointsOrder ${order.code} cancelled but memberLevel unavailable, points NOT refunded`, loggerCtx);
        }
        await this.connection
            .getRepository(ctx, points_product_entity_1.PointsProduct)
            .createQueryBuilder()
            .update(points_product_entity_1.PointsProduct)
            .set({ stock: () => `stock + ${order.quantity}`, redeemedCount: () => `redeemedCount - ${order.quantity}` })
            .where('id = :id', { id: order.pointsProductId })
            .execute();
        await this.connection
            .getRepository(ctx, points_order_payment_entity_1.PointsOrderPayment)
            .createQueryBuilder()
            .update(points_order_payment_entity_1.PointsOrderPayment)
            .set({ status: 'cancelled' })
            .where('orderId = :orderId AND status = :status', { orderId: order.id, status: 'pending' })
            .execute();
        return true;
    }
    /** 未支付取消：退积分 + 回补库存 + 支付单置 cancelled。 */
    async cancelPointsOrder(ctx, id) {
        if (!this.memberLevel) {
            throw new core_1.UserInputError('Member level service unavailable');
        }
        const customer = await this.requireCustomer(ctx);
        const repo = this.connection.getRepository(ctx, points_order_entity_1.PointsOrder);
        const order = await repo.findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId },
        });
        if (!order)
            throw new core_1.UserInputError('Points order not found');
        if (order.status !== 'pending_payment') {
            throw new core_1.UserInputError('ORDER_NOT_CANCELLABLE');
        }
        await this.connection.startTransaction(ctx);
        try {
            const done = await this.executeCancel(ctx, order, `Points order ${order.code} cancel refund`);
            if (!done) {
                await this.connection.commitOpenTransaction(ctx);
                throw new core_1.UserInputError('ORDER_NOT_CANCELLABLE');
            }
            await this.connection.commitOpenTransaction(ctx);
        }
        catch (e) {
            await this.connection.rollBackTransaction(ctx);
            throw e;
        }
        core_1.Logger.info(`PointsOrder ${order.code} cancelled by customer ${customer.id}, refunded ${order.pointsTotal} points`, loggerCtx);
        return Object.assign(Object.assign({}, order), { status: 'cancelled' });
    }
    /** 定时任务入口：取消 ctx 渠道内 createdAt < before 的待支付单，返回取消数量 */
    async cancelExpiredOrders(ctx, before) {
        const repo = this.connection.getRepository(ctx, points_order_entity_1.PointsOrder);
        const expired = await repo.find({
            where: { status: 'pending_payment', channelId: ctx.channelId },
        });
        let count = 0;
        for (const order of expired) {
            if (order.createdAt >= before)
                continue;
            await this.connection.startTransaction(ctx);
            try {
                if (await this.executeCancel(ctx, order, `Points order ${order.code} timeout refund`)) {
                    count++;
                    core_1.Logger.info(`PointsOrder ${order.code} expired-cancelled, refunded ${order.pointsTotal} points`, loggerCtx);
                }
                await this.connection.commitOpenTransaction(ctx);
            }
            catch (e) {
                await this.connection.rollBackTransaction(ctx);
                core_1.Logger.error(`PointsOrder ${order.code} expire-cancel failed: ${String(e)}`, loggerCtx);
            }
        }
        return count;
    }
    // ===== 订单查询 =====
    async myPointsOrders(ctx, options) {
        var _a;
        const customer = await this.requireCustomer(ctx);
        const qb = this.connection
            .getRepository(ctx, points_order_entity_1.PointsOrder)
            .createQueryBuilder('po')
            .where('po.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('po.customerId = :customerId', { customerId: customer.id });
        if (options === null || options === void 0 ? void 0 : options.status) {
            qb.andWhere('po.status = :status', { status: options.status });
        }
        const [items, totalItems] = await qb
            .orderBy('po.id', 'DESC')
            .skip(options === null || options === void 0 ? void 0 : options.skip)
            .take((_a = options === null || options === void 0 ? void 0 : options.take) !== null && _a !== void 0 ? _a : 20)
            .getManyAndCount();
        return { items, totalItems };
    }
    async myPointsOrder(ctx, id) {
        var _a;
        const customer = await this.requireCustomer(ctx);
        return ((_a = (await this.connection.getRepository(ctx, points_order_entity_1.PointsOrder).findOne({
            where: { id: Number(id), customerId: customer.id, channelId: ctx.channelId },
        }))) !== null && _a !== void 0 ? _a : undefined);
    }
    async adminPointsOrders(ctx, options) {
        var _a, _b;
        const qb = this.connection
            .getRepository(ctx, points_order_entity_1.PointsOrder)
            .createQueryBuilder('po')
            .where('po.channelId = :channelId', { channelId: ctx.channelId });
        if (options === null || options === void 0 ? void 0 : options.status) {
            qb.andWhere('po.status = :status', { status: options.status });
        }
        const kw = (_a = options === null || options === void 0 ? void 0 : options.keyword) === null || _a === void 0 ? void 0 : _a.trim();
        if (kw) {
            // 单号模糊；纯数字时追加 PO-<id> 前缀精确与 customerId 精确
            const LIKE = this.connection.rawConnection.options.type === 'postgres' ? 'ILIKE' : 'LIKE';
            qb.andWhere(new typeorm_1.Brackets(w => {
                w.where(`po.code ${LIKE} :kw`, { kw: `%${kw}%` });
                if (/^\d+$/.test(kw)) {
                    w.orWhere('po.code = :codeExact', { codeExact: 'PO-' + kw });
                    w.orWhere('po.customerId = :cid', { cid: Number(kw) });
                }
            }));
        }
        const [items, totalItems] = await qb
            .orderBy('po.id', 'DESC')
            .skip(options === null || options === void 0 ? void 0 : options.skip)
            .take((_b = options === null || options === void 0 ? void 0 : options.take) !== null && _b !== void 0 ? _b : 20)
            .getManyAndCount();
        return { items, totalItems };
    }
    // ===== admin 履约状态机 =====
    async markPointsOrderPaid(ctx, id) {
        return this.applyTransition(ctx, id, 'pending_payment', o => {
            const virtual = o.deliveryType === 'virtual';
            return Object.assign({ status: virtual ? 'completed' : 'pending_ship', paidAt: new Date() }, (virtual ? { completedAt: new Date() } : {}));
        });
    }
    async markPointsOrderShipped(ctx, id, trackingNo) {
        return this.applyTransition(ctx, id, 'pending_ship', () => ({
            status: 'shipped',
            shippedAt: new Date(),
            trackingNo: trackingNo || null,
        }));
    }
    async markPointsOrderCompleted(ctx, id) {
        return this.applyTransition(ctx, id, 'shipped', () => ({
            status: 'completed',
            completedAt: new Date(),
        }));
    }
    async applyTransition(ctx, id, fromStatus, patchFn) {
        const repo = this.connection.getRepository(ctx, points_order_entity_1.PointsOrder);
        const existing = await repo.findOne({ where: { id: Number(id), channelId: ctx.channelId } });
        if (!existing)
            throw new core_1.UserInputError('Points order not found');
        const patch = patchFn(existing);
        // 原子抢占：status 条件在 UPDATE 内，并发双击只成功一次
        const claim = await repo
            .createQueryBuilder()
            .update(points_order_entity_1.PointsOrder)
            .set(patch)
            .where('id = :id AND status = :status AND channelId = :channelId', {
            id: existing.id,
            status: fromStatus,
            channelId: ctx.channelId,
        })
            .execute();
        if (claim.affected === 0) {
            throw new core_1.UserInputError(`Points order is ${existing.status}`);
        }
        core_1.Logger.info(`PointsOrder ${existing.code} ${fromStatus} -> ${patch.status}`, loggerCtx);
        return Object.assign(Object.assign({}, existing), patch);
    }
};
exports.PointsMallService = PointsMallService;
exports.PointsMallService = PointsMallService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.ProductPriceApplicator,
        core_1.ConfigService])
], PointsMallService);
//# sourceMappingURL=points-mall.service.js.map