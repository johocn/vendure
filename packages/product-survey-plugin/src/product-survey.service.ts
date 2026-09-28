import {
    BadRequestException,
    HttpException,
    Inject,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import {
    Channel,
    ChannelNotFoundError,
    ChannelService,
    CollectionService,
    Logger,
    Product,
    ProductService,
    ProductVariant,
    ProductVariantService,
    RequestContext,
    TranslatorService,
} from '@vendure/core';

import { PRODUCT_DETAIL_PATH, PRODUCT_SURVEY_PLUGIN_OPTIONS, SLUG_PATTERN, loggerCtx } from './constants';
import { CandidatesResponse, ProductSurveyPluginOptions, SurveyProductCard, SurveyVariant } from './types';

interface CandidatesParams {
    collection?: string;
    onsale?: string;
    take?: string;
}

/**
 * 只读候选商品服务：供 C 端活动页读取候选（含未上架）与上架在售商品。
 * 所有价格/链接/图片加工都在服务端完成，C 端不拼不算。
 */
@Injectable()
export class ProductSurveyService {
    constructor(
        private channelService: ChannelService,
        private collectionService: CollectionService,
        private productService: ProductService,
        private productVariantService: ProductVariantService,
        private translator: TranslatorService,
        @Inject(PRODUCT_SURVEY_PLUGIN_OPTIONS) private options: ProductSurveyPluginOptions,
    ) {}

    private get defaultTake(): number {
        return this.options.defaultTake ?? 50;
    }

    private get maxTake(): number {
        return this.options.maxTake ?? 100;
    }

    async getCandidates(token: string | undefined, params: CandidatesParams): Promise<CandidatesResponse> {
        const collectionSlug = params.collection?.trim();
        const onsale = params.onsale === '1';

        // 两个筛选条件都缺省 → 400；同时存在时以 collection 优先
        if (!collectionSlug && !onsale) {
            throw new BadRequestException('必须提供 collection 或 onsale=1');
        }

        const requestedTake = Number.parseInt(params.take ?? '', 10);
        const take =
            Number.isFinite(requestedTake) && requestedTake > 0
                ? Math.min(requestedTake, this.maxTake)
                : this.defaultTake;

        const channel = await this.resolveChannel(token);
        // 只读 shop 上下文：默认语言取渠道默认语言
        const ctx = new RequestContext({
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
        } catch (e) {
            if (e instanceof HttpException) {
                throw e;
            }
            // 不泄漏堆栈，仅回传简短 message
            Logger.error(`候选商品查询失败: ${(e as Error)?.message}`, loggerCtx);
            throw new InternalServerErrorException((e as Error)?.message ?? '内部错误');
        }
    }

    /** vendure-token 解析渠道；无 header 传 '' 返回默认渠道，非法 token → 400 */
    private async resolveChannel(token?: string): Promise<Channel> {
        try {
            return await this.channelService.getChannelFromToken(token ?? '');
        } catch (e) {
            if (e instanceof ChannelNotFoundError) {
                throw new BadRequestException(`无效的渠道 token: ${token ?? ''}`);
            }
            throw e;
        }
    }

    /** collection 分支：返回集合内全部变体（不过滤 product.enabled），聚合为商品卡片 */
    private async buildFromCollection(
        ctx: RequestContext,
        channelInfo: { id: string; code: string },
        slug: string,
        take: number,
    ): Promise<CandidatesResponse> {
        const collection = await this.collectionService.findOneBySlug(ctx, slug);
        if (!collection) {
            // Collection 不存在 → products: [] 且 HTTP 200
            return { channel: channelInfo, collection: null, products: [] };
        }
        const collectionInfo = { slug: collection.slug ?? slug, name: collection.name };

        // 注意：getVariantsByCollectionId 默认只加载 taxCategory，不会 hydrate product；
        // 这里显式传入 product 及其 featuredAsset/translations 关系。
        const { items: variants } = await this.productVariantService.getVariantsByCollectionId(
            ctx,
            collection.id,
            { take },
            [
                'product',
                'product.featuredAsset',
                'product.translations',
                'featuredAsset',
                'translations',
                'options',
            ],
        );

        // 按商品分组（同一商品的所有变体聚合到一张卡片）
        const groups = new Map<string, { product: Product; variants: ProductVariant[] }>();
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
    private async buildOnSale(
        ctx: RequestContext,
        channelInfo: { id: string; code: string },
        take: number,
    ): Promise<CandidatesResponse> {
        const maxVariants = this.options.maxVariantsPerProduct ?? 20;
        const { items: products } = await this.productService.findAll(
            ctx,
            { take, filter: { enabled: { eq: true } } },
            ['featuredAsset'],
        );

        const cards = await Promise.all(
            products.map(async product => {
                // findAll 已翻译商品名；变体通过 getVariantsByProductId 单独取并已应用渠道价税
                const { items: variants } = await this.productVariantService.getVariantsByProductId(
                    ctx,
                    product.id,
                    {
                        take: maxVariants,
                    },
                );
                return this.toProductCard(product, variants);
            }),
        );

        return { channel: channelInfo, collection: null, products: cards };
    }

    /**
     * 商品卡片转换（两个分支共用）。
     * - 链接：仅当 slug 匹配 ^[a-z0-9][a-z0-9-]*$ 时拼 /pkg-product/pages/detail?slug=<slug>
     * - 价格：统一用 variant.priceWithTax（整数，单位分）转元；<=0 视为未配价
     * - 图片：首个有 featuredAsset 的变体 → 商品 featuredAsset → null
     * - 划线价：Vendure 无该字段，不提供
     */
    private toProductCard(product: Product, variants: ProductVariant[]): SurveyProductCard {
        const rawSlug = product.slug;
        const slug = typeof rawSlug === 'string' && SLUG_PATTERN.test(rawSlug) ? rawSlug : null;
        const link = slug ? `${PRODUCT_DETAIL_PATH}?slug=${slug}` : null;

        const image =
            (
                variants[0]?.featuredAsset ??
                variants.find(v => v.featuredAsset)?.featuredAsset ??
                product.featuredAsset
            )?.preview ?? null;

        const mappedVariants: SurveyVariant[] = variants.map(variant => {
            const price = variant.priceWithTax;
            return {
                id: String(variant.id),
                name: variant.name,
                ...(price > 0 ? { priceText: formatPrice(price) } : {}),
            };
        });

        // 未配价（全部变体 priceWithTax <= 0）→ priceConfigured=false 且不输出价格文案
        const priced = variants.filter(v => v.priceWithTax > 0);
        const priceConfigured = priced.length > 0;
        // 商品级 priceFromText 取最小变体价；多规格（>1 个变体）追加「起」，单规格不带「起」
        const priceFromText = priceConfigured
            ? `${formatPrice(Math.min(...priced.map(v => v.priceWithTax)))}${
                  variants.length > 1 ? ' 起' : ''
              }`
            : undefined;

        return {
            id: String(product.id),
            name: product.name,
            slug,
            image,
            enabled: product.enabled,
            link,
            linkAvailable: link !== null,
            priceConfigured,
            ...(priceFromText ? { priceFromText } : {}),
            variants: mappedVariants,
        };
    }
}

/** 分（整数）→ 元字符串，两位小数，¥ 前缀 */
function formatPrice(cents: number): string {
    return `¥${(cents / 100).toFixed(2)}`;
}
