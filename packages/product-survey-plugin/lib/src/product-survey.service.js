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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSurveyService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
/**
 * 只读候选商品服务：供 C 端活动页读取候选（含未上架）与上架在售商品。
 * 所有价格/链接/图片加工都在服务端完成，C 端不拼不算。
 */
let ProductSurveyService = class ProductSurveyService {
    constructor(channelService, collectionService, productService, productVariantService, translator, options) {
        this.channelService = channelService;
        this.collectionService = collectionService;
        this.productService = productService;
        this.productVariantService = productVariantService;
        this.translator = translator;
        this.options = options;
    }
    get defaultTake() {
        var _a;
        return (_a = this.options.defaultTake) !== null && _a !== void 0 ? _a : 50;
    }
    get maxTake() {
        var _a;
        return (_a = this.options.maxTake) !== null && _a !== void 0 ? _a : 100;
    }
    async getCandidates(token, params) {
        var _a, _b, _c;
        const collectionSlug = (_a = params.collection) === null || _a === void 0 ? void 0 : _a.trim();
        const onsale = params.onsale === '1';
        // 两个筛选条件都缺省 → 400；同时存在时以 collection 优先
        if (!collectionSlug && !onsale) {
            throw new common_1.BadRequestException('必须提供 collection 或 onsale=1');
        }
        const requestedTake = Number.parseInt((_b = params.take) !== null && _b !== void 0 ? _b : '', 10);
        const take = Number.isFinite(requestedTake) && requestedTake > 0 ? Math.min(requestedTake, this.maxTake) : this.defaultTake;
        const channel = await this.resolveChannel(token);
        // 只读 shop 上下文：默认语言取渠道默认语言
        const ctx = new core_1.RequestContext({
            apiType: 'shop',
            channel,
            languageCode: channel.defaultLanguageCode,
            isAuthorized: true,
            authorizedAsOwnerOnly: false,
        });
        const channelInfo = { id: String(channel.id), code: channel.code };
        try {
            return collectionSlug
                ? await this.buildFromCollection(ctx, channelInfo, collectionSlug, take)
                : await this.buildOnSale(ctx, channelInfo, take);
        }
        catch (e) {
            if (e instanceof common_1.HttpException) {
                throw e;
            }
            // 不泄漏堆栈，仅回传简短 message
            core_1.Logger.error(`候选商品查询失败: ${e === null || e === void 0 ? void 0 : e.message}`, constants_1.loggerCtx);
            throw new common_1.InternalServerErrorException((_c = e === null || e === void 0 ? void 0 : e.message) !== null && _c !== void 0 ? _c : '内部错误');
        }
    }
    /** vendure-token 解析渠道；无 header 传 '' 返回默认渠道，非法 token → 400 */
    async resolveChannel(token) {
        try {
            return await this.channelService.getChannelFromToken(token !== null && token !== void 0 ? token : '');
        }
        catch (e) {
            if (e instanceof core_1.ChannelNotFoundError) {
                throw new common_1.BadRequestException(`无效的渠道 token: ${token !== null && token !== void 0 ? token : ''}`);
            }
            throw e;
        }
    }
    /** collection 分支：返回集合内全部变体（不过滤 product.enabled），聚合为商品卡片 */
    async buildFromCollection(ctx, channelInfo, slug, take) {
        var _a;
        const collection = await this.collectionService.findOneBySlug(ctx, slug);
        if (!collection) {
            // Collection 不存在 → products: [] 且 HTTP 200
            return { channel: channelInfo, collection: null, products: [] };
        }
        const collectionInfo = { slug: (_a = collection.slug) !== null && _a !== void 0 ? _a : slug, name: collection.name };
        // 注意：getVariantsByCollectionId 默认只加载 taxCategory，不会 hydrate product；
        // 这里显式传入 product 及其 featuredAsset/translations 关系。
        const { items: variants } = await this.productVariantService.getVariantsByCollectionId(ctx, collection.id, { take }, [
            'product',
            'product.featuredAsset',
            'product.translations',
            'featuredAsset',
            'translations',
            'options',
        ]);
        // 按商品分组（同一商品的所有变体聚合到一张卡片）
        const groups = new Map();
        for (const variant of variants) {
            const product = variant.product;
            if (!product) {
                continue;
            }
            const key = String(product.id);
            let group = groups.get(key);
            if (!group) {
                group = { product, variants: [] };
                groups.set(key, group);
            }
            group.variants.push(variant);
        }
        const products = [...groups.values()].map(group => {
            // 商品名/slug 存放在 translations 上，未 translate 时 product.name 为 undefined，
            // 必须显式翻译后再读取。
            const translated = this.translator.translate(group.product, ctx);
            return this.toProductCard(translated, group.variants);
        });
        return { channel: channelInfo, collection: collectionInfo, products };
    }
    /** onsale 分支：该渠道全部上架（enabled=true）商品，take 语义为商品数 */
    async buildOnSale(ctx, channelInfo, take) {
        var _a;
        const maxVariants = (_a = this.options.maxVariantsPerProduct) !== null && _a !== void 0 ? _a : 20;
        const { items: products } = await this.productService.findAll(ctx, { take, filter: { enabled: { eq: true } } }, ['featuredAsset']);
        const cards = await Promise.all(products.map(async (product) => {
            // findAll 已翻译商品名；变体通过 getVariantsByProductId 单独取并已应用渠道价税
            const { items: variants } = await this.productVariantService.getVariantsByProductId(ctx, product.id, {
                take: maxVariants,
            });
            return this.toProductCard(product, variants);
        }));
        return { channel: channelInfo, collection: null, products: cards };
    }
    /**
     * 商品卡片转换（两个分支共用）。
     * - 链接：仅当 slug 匹配 ^[a-z0-9][a-z0-9-]*$ 时拼 /pkg-product/pages/detail?slug=<slug>
     * - 价格：统一用 variant.priceWithTax（整数，单位分）转元；<=0 视为未配价
     * - 图片：首个有 featuredAsset 的变体 → 商品 featuredAsset → null
     * - 划线价：Vendure 无该字段，不提供
     */
    toProductCard(product, variants) {
        var _a, _b, _c, _d, _e, _f;
        const rawSlug = product.slug;
        const slug = typeof rawSlug === 'string' && constants_1.SLUG_PATTERN.test(rawSlug) ? rawSlug : null;
        const link = slug ? `${constants_1.PRODUCT_DETAIL_PATH}?slug=${slug}` : null;
        const image = (_f = (_e = ((_d = (_b = (_a = variants[0]) === null || _a === void 0 ? void 0 : _a.featuredAsset) !== null && _b !== void 0 ? _b : (_c = variants.find(v => v.featuredAsset)) === null || _c === void 0 ? void 0 : _c.featuredAsset) !== null && _d !== void 0 ? _d : product.featuredAsset)) === null || _e === void 0 ? void 0 : _e.preview) !== null && _f !== void 0 ? _f : null;
        const mappedVariants = variants.map(variant => {
            const price = variant.priceWithTax;
            return Object.assign({ id: String(variant.id), name: variant.name }, (price > 0 ? { priceText: formatPrice(price) } : {}));
        });
        // 未配价（全部变体 priceWithTax <= 0）→ priceConfigured=false 且不输出价格文案
        const priced = variants.filter(v => v.priceWithTax > 0);
        const priceConfigured = priced.length > 0;
        // 商品级 priceFromText 取最小变体价；多规格（>1 个变体）追加「起」，单规格不带「起」
        const priceFromText = priceConfigured
            ? `${formatPrice(Math.min(...priced.map(v => v.priceWithTax)))}${variants.length > 1 ? ' 起' : ''}`
            : undefined;
        return Object.assign(Object.assign({ id: String(product.id), name: product.name, slug,
            image, enabled: product.enabled, link, linkAvailable: link !== null, priceConfigured }, (priceFromText ? { priceFromText } : {})), { variants: mappedVariants });
    }
};
exports.ProductSurveyService = ProductSurveyService;
exports.ProductSurveyService = ProductSurveyService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(constants_1.PRODUCT_SURVEY_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [core_1.ChannelService,
        core_1.CollectionService,
        core_1.ProductService,
        core_1.ProductVariantService,
        core_1.TranslatorService, Object])
], ProductSurveyService);
/** 分（整数）→ 元字符串，两位小数，¥ 前缀 */
function formatPrice(cents) {
    return `¥${(cents / 100).toFixed(2)}`;
}
//# sourceMappingURL=product-survey.service.js.map