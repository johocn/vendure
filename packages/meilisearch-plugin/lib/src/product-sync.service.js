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
exports.ProductSyncService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const meili_service_1 = require("./meili.service");
const product_document_mapper_1 = require("./product-document.mapper");
const REINDEX_QUEUE_NAME = 'meili-reindex-products';
const PRODUCT_CHUNK_SIZE = 500;
const UPSERT_BATCH_SIZE = 500;
let ProductSyncService = class ProductSyncService {
    constructor(opts, meili, jobQueueService, connection) {
        this.opts = opts;
        this.meili = meili;
        this.jobQueueService = jobQueueService;
        this.connection = connection;
    }
    /** 照 order-timeout-plugin 模式：由 plugin.onApplicationBootstrap 调用 */
    async initQueue() {
        this.queue = await this.jobQueueService.createQueue({
            name: REINDEX_QUEUE_NAME,
            process: async ({ data, id }) => {
                if (data.productId) {
                    await this.syncOne(data.productId);
                }
                else {
                    await this.syncAll();
                }
                core_1.Logger.info(`Meili product reindex job ${id} done`, constants_1.loggerCtx);
            },
        });
    }
    /** 单品或全量入队；Meili 不可用导致的 job 失败由 retries 兜底重试 */
    async enqueue(productIds) {
        if (!this.queue) {
            core_1.Logger.warn(`Queue ${REINDEX_QUEUE_NAME} not ready, reindex request dropped`, constants_1.loggerCtx);
            return;
        }
        if (productIds === null || productIds === void 0 ? void 0 : productIds.length) {
            for (const productId of productIds) {
                await this.queue.add({ productId: String(productId) }, { retries: 5 });
            }
            return;
        }
        await this.queue.add({ all: true }, { retries: 5 });
    }
    async syncAll() {
        await this.projectAll(this.connection.rawConnection.manager, [...this.opts.locales], this.urlBase());
    }
    /** 商品主图绝对地址前缀（Vendure 资产服务公网域名）；未配置则文档省略 thumbnail */
    assetBase() {
        var _a;
        return ((_a = process.env.PUBLIC_ASSET_URL) !== null && _a !== void 0 ? _a : '').replace(/\/+$/, '');
    }
    /**
     * 全量投影：分块查 Product（防大表）→ 组装投影 → toProductDocuments → 按 locale 500 条/批 upsert
     */
    async projectAll(em, locales, urlBase) {
        const docsByLocale = new Map(locales.map(locale => [locale, []]));
        const repo = em.getRepository(core_1.Product);
        let skip = 0;
        for (;;) {
            const products = await repo.find({
                relations: {
                    translations: true,
                    variants: { productVariantPrices: true, collections: true },
                    channels: true,
                    featuredAsset: true,
                },
                skip,
                take: PRODUCT_CHUNK_SIZE,
                order: { id: 'ASC' },
            });
            if (!products.length)
                break;
            for (const product of products) {
                // 已软删商品：同步清索引（全量重建是 upsert 语义，残留文档不会自动消失）
                if (product.deletedAt) {
                    await this.removeProduct(String(product.id));
                    continue;
                }
                const projection = this.toProjection(product, urlBase);
                // toProductDocuments 按 locales 顺序产出，zip 回对应 locale 桶
                (0, product_document_mapper_1.toProductDocuments)(projection, locales).forEach((doc, i) => {
                    var _a;
                    (_a = docsByLocale.get(locales[i])) === null || _a === void 0 ? void 0 : _a.push(doc);
                });
            }
            if (products.length < PRODUCT_CHUNK_SIZE)
                break;
            skip += PRODUCT_CHUNK_SIZE;
        }
        for (const [locale, docs] of docsByLocale) {
            await this.upsertInBatches(locale, docs);
        }
        core_1.Logger.info(`Meili projectAll done: ${[...docsByLocale.entries()]
            .map(([locale, docs]) => `${locale}=${docs.length}`)
            .join(', ')}`, constants_1.loggerCtx);
        return docsByLocale;
    }
    /**
     * 单品同步：published → 各语言索引 upsert；draft/disabled → deleteDocuments；
     * 产品已不存在时也做删除（变体/商品删除事件兜底清理）
     */
    async syncOne(productId) {
        const product = await this.connection.rawConnection.manager.getRepository(core_1.Product).findOne({
            where: { id: productId },
            relations: {
                translations: true,
                variants: { productVariantPrices: true, collections: true },
                channels: true,
                featuredAsset: true,
            },
        });
        if (!product || product.deletedAt) {
            core_1.Logger.warn(`Meili syncOne: product ${productId} ${product ? 'soft-deleted' : 'not found'}, removing docs`, constants_1.loggerCtx);
            await this.removeProduct(String(productId));
            return;
        }
        const projection = this.toProjection(product, this.urlBase());
        const docs = (0, product_document_mapper_1.toProductDocuments)(projection, this.opts.locales);
        if (docs.length) {
            for (let i = 0; i < docs.length; i++) {
                await this.meili.upsertDocuments(this.opts.locales[i], [docs[i]]);
            }
        }
        else {
            await this.removeProduct(String(productId));
        }
    }
    /** 从所有语言索引删除该商品文档（ProductEvent deleted 直连清理入口） */
    async removeProduct(productId) {
        for (const locale of this.opts.locales) {
            await this.meili.deleteDocuments(locale, [(0, product_document_mapper_1.productDocId)(productId)]);
        }
    }
    urlBase() {
        var _a;
        return (_a = process.env.PUBLIC_STOREFRONT_URL) !== null && _a !== void 0 ? _a : '';
    }
    async upsertInBatches(locale, docs) {
        for (let i = 0; i < docs.length; i += UPSERT_BATCH_SIZE) {
            await this.meili.upsertDocuments(locale, docs.slice(i, i + UPSERT_BATCH_SIZE));
        }
    }
    toProjection(product, urlBase) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const zh = (_a = product.translations) === null || _a === void 0 ? void 0 : _a.find(t => t.languageCode === core_1.LanguageCode.zh_Hans);
        const en = (_b = product.translations) === null || _b === void 0 ? void 0 : _b.find(t => t.languageCode === core_1.LanguageCode.en);
        const channelId = this.resolveChannelId(product);
        const assetBase = this.assetBase();
        const preview = (_d = (_c = product.featuredAsset) === null || _c === void 0 ? void 0 : _c.preview) !== null && _d !== void 0 ? _d : '';
        const thumbnailUrl = assetBase && preview ? `${assetBase}/${preview.replace(/^\/+/, '')}` : '';
        return Object.assign({ productId: String(product.id), channelId, status: product.enabled && !product.deletedAt ? 'published' : 'draft', updatedAt: product.updatedAt ? new Date(product.updatedAt).getTime() : Date.now(), nameZh: (_e = zh === null || zh === void 0 ? void 0 : zh.name) !== null && _e !== void 0 ? _e : '', nameEn: (_f = en === null || en === void 0 ? void 0 : en.name) !== null && _f !== void 0 ? _f : '', descZh: (_g = zh === null || zh === void 0 ? void 0 : zh.description) !== null && _g !== void 0 ? _g : '', descEn: (_h = en === null || en === void 0 ? void 0 : en.description) !== null && _h !== void 0 ? _h : '', slugZh: (_j = zh === null || zh === void 0 ? void 0 : zh.slug) !== null && _j !== void 0 ? _j : '', slugEn: (_k = en === null || en === void 0 ? void 0 : en.slug) !== null && _k !== void 0 ? _k : '', price: this.resolvePrice(product, channelId), collectionIds: [
                ...new Set(((_l = product.variants) !== null && _l !== void 0 ? _l : []).flatMap(v => { var _a; return ((_a = v.collections) !== null && _a !== void 0 ? _a : []).map(c => String(c.id)); })),
            ], tags: [], urlBase }, (thumbnailUrl ? { thumbnailUrl } : {}));
    }
    /** channelId：第一个非默认渠道 id（默认渠道 code '__default_channel__'）；全无则回退默认渠道 '1' */
    resolveChannelId(product) {
        var _a;
        const nonDefault = ((_a = product.channels) !== null && _a !== void 0 ? _a : []).find(c => c.code !== '__default_channel__');
        if (nonDefault)
            return String(nonDefault.id);
        return '1';
    }
    /**
     * 取价照 vcash-pos-plugin 口径：ProductVariant.price 是 @Calculated 字段（依赖运行时 listPrice），
     * 原始查询下恒为 0，须读 productVariantPrices 关联按渠道匹配取真实价格。
     */
    resolvePrice(product, channelId) {
        var _a;
        const prices = ((_a = product.variants) !== null && _a !== void 0 ? _a : [])
            .map(v => {
            var _a, _b, _c;
            return (_c = (_b = (_a = v.productVariantPrices) === null || _a === void 0 ? void 0 : _a.find(p => Number(p.channelId) === Number(channelId))) === null || _b === void 0 ? void 0 : _b.price) !== null && _c !== void 0 ? _c : 0;
        })
            .filter(p => p > 0);
        return prices.length ? Math.min(...prices) : 0;
    }
};
exports.ProductSyncService = ProductSyncService;
exports.ProductSyncService = ProductSyncService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.MEILI_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, meili_service_1.MeiliService,
        core_1.JobQueueService,
        core_1.TransactionalConnection])
], ProductSyncService);
//# sourceMappingURL=product-sync.service.js.map