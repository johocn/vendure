import { INestApplication } from '@nestjs/common';
import {
    ChannelService,
    CollectionService,
    ConfigService,
    ProductService,
    ProductVariantService,
    RequestContext,
    isInspectableJobQueueStrategy,
} from '@vendure/core';

import { withCtx, createAdminCtx } from './shared';

const APPLY_FILTERS_QUEUE = 'apply-collection-filters';
const UNSETTLED_STATES = ['PENDING', 'RUNNING', 'RETRYING'];

async function waitForApplyFiltersJobs(app: INestApplication, timeoutMs = 30000): Promise<void> {
    const configService = app.get(ConfigService);
    const strategy = configService.jobQueueOptions.jobQueueStrategy;
    if (!isInspectableJobQueueStrategy(strategy)) {
        console.warn('  JobQueueStrategy 不可检查，跳过等待 apply-collection-filters 任务');
        return;
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const result = await strategy.findMany({
            filter: { queueName: { eq: APPLY_FILTERS_QUEUE } },
            take: 100,
        });
        const unsettled = result.items.filter(j => UNSETTLED_STATES.includes(j.state));
        if (unsettled.length === 0) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.warn(`  等待 apply-collection-filters 任务超时 (${timeoutMs}ms)`);
}

interface FloorSeed {
    name: string;
    slug: string;
    description: string;
    channel: 'default' | 'shop-a';
    productSkus: string[];
    customFields: {
        floorEnabled: boolean;
        floorTitle: string;
        floorSubtitle: string;
        floorLayout: 'single_scroll' | 'double_grid' | 'triple_grid' | 'hero_with_list';
        floorSortOrder: number;
        floorMaxScreens: number;
        floorTheme: { primaryColor: string; backgroundColor: string; titleIcon: string };
        floorItemConfig: Array<{ productId: string; size: string; highlighted: boolean; label: string }>;
        floorSchedule: { startAt: string | null; endAt: string | null } | null;
    };
}

const FLOORS: FloorSeed[] = [
    {
        name: '精选好物',
        slug: 'featured',
        description: '精选好物推荐',
        channel: 'default',
        productSkus: ['NF-WATER-500', 'TS-NUT-1KG', 'NF-RICE-5KG', 'XM-BAND-8-STD'],
        customFields: {
            floorEnabled: true,
            floorTitle: '精选好物',
            floorSubtitle: '为你挑选的优质商品',
            floorLayout: 'double_grid',
            floorSortOrder: 1,
            floorMaxScreens: 1,
            floorTheme: { primaryColor: '#ff6600', backgroundColor: '#fff3e6', titleIcon: '🔥' },
            floorItemConfig: [
                { productId: '', size: 'medium', highlighted: false, label: '' },
                { productId: '', size: 'medium', highlighted: true, label: '热销' },
                { productId: '', size: 'medium', highlighted: false, label: '' },
                { productId: '', size: 'medium', highlighted: false, label: '新品' },
            ],
            floorSchedule: null,
        },
    },
    {
        name: '数码专区',
        slug: 'digital-zone',
        description: '数码电器专场',
        channel: 'default',
        productSkus: ['XM-BAND-8-PRO', 'HW-ROUTER-STD', 'XM-PB-10000', 'HW-BT-EAR-STD'],
        customFields: {
            floorEnabled: true,
            floorTitle: '数码专区',
            floorSubtitle: '科技改变生活',
            floorLayout: 'triple_grid',
            floorSortOrder: 2,
            floorMaxScreens: 1,
            floorTheme: { primaryColor: '#1890ff', backgroundColor: '#e6f7ff', titleIcon: '📱' },
            floorItemConfig: [
                { productId: '', size: 'small', highlighted: false, label: '' },
                { productId: '', size: 'small', highlighted: false, label: '' },
                { productId: '', size: 'small', highlighted: true, label: '爆款' },
                { productId: '', size: 'small', highlighted: false, label: '' },
            ],
            floorSchedule: null,
        },
    },
    {
        name: '生鲜特惠',
        slug: 'fresh-deals',
        description: '生鲜特惠专场',
        channel: 'shop-a',
        productSkus: ['TS-NUT-1KG', 'NF-RICE-5KG', 'TS-BEEF-500'],
        customFields: {
            floorEnabled: true,
            floorTitle: '生鲜特惠',
            floorSubtitle: '新鲜直达',
            floorLayout: 'hero_with_list',
            floorSortOrder: 1,
            floorMaxScreens: 1,
            floorTheme: { primaryColor: '#07c160', backgroundColor: '#e6f7ee', titleIcon: '🥬' },
            floorItemConfig: [
                { productId: '', size: 'large', highlighted: true, label: '主推' },
                { productId: '', size: 'medium', highlighted: false, label: '' },
                { productId: '', size: 'medium', highlighted: false, label: '' },
            ],
            // 定时上下线测试：已过期，应被 filterActiveFloors 过滤掉
            floorSchedule: { startAt: '2026-01-01T00:00:00Z', endAt: '2026-06-01T00:00:00Z' },
        },
    },
];

export async function populateFloors(app: INestApplication): Promise<void> {
    const channelService = app.get(ChannelService);
    const collectionService = app.get(CollectionService);
    const productService = app.get(ProductService);
    const productVariantService = app.get(ProductVariantService);
    const defaultChannel = await channelService.getDefaultChannel();

    const allChannels = await channelService.findAll(await createAdminCtx(app, defaultChannel));
    const shopAChannel = allChannels.items.find(c => c.code === 'shop-a');

    for (const floor of FLOORS) {
        const targetChannel = floor.channel === 'default' ? defaultChannel : shopAChannel;
        if (!targetChannel) {
            console.warn(`  跳过楼层 ${floor.name}: channel ${floor.channel} 不存在`);
            continue;
        }

        await withCtx(app, targetChannel, async (ctx: RequestContext) => {
            // 1. 查询当前 Channel 的所有商品，建立 SKU → productId 映射
            const variants = await productVariantService.findAll(ctx, { take: 999 });
            const skuToProductId: Record<string, string> = {};
            for (const v of variants.items) {
                if (v.sku) {
                    skuToProductId[v.sku] = String(v.productId);
                }
            }

            // 2. 根据 productSkus 收集真实的 product IDs
            const realProductIds: string[] = [];
            const skuToIndex: Record<string, number> = {};
            for (let i = 0; i < floor.productSkus.length; i++) {
                const sku = floor.productSkus[i];
                const pid = skuToProductId[sku];
                if (pid) {
                    realProductIds.push(pid);
                    skuToIndex[sku] = i;
                } else {
                    console.warn(`  警告: SKU ${sku} 在 channel ${floor.channel} 中未找到`);
                }
            }

            if (realProductIds.length === 0) {
                console.warn(`  跳过楼层 ${floor.name}: 无有效商品`);
                return;
            }

            // 3. 填充 floorItemConfig 中的真实 productId
            const itemConfig = floor.customFields.floorItemConfig.map((item, idx) => {
                const sku = floor.productSkus[idx];
                return {
                    ...item,
                    productId: skuToProductId[sku] || '',
                };
            });

            // 4. 创建 Collection（使用 translations 格式，非顶层 name/slug）
            const collection = await collectionService.create(ctx, {
                translations: [
                    {
                        languageCode: ctx.languageCode,
                        name: floor.name,
                        slug: floor.slug,
                        description: floor.description,
                    },
                ],
                filters: [
                    {
                        code: 'product-id-filter',
                        arguments: [
                            { name: 'productIds', value: JSON.stringify(realProductIds) },
                            { name: 'combineWithAnd', value: 'false' },
                        ],
                    },
                ],
                customFields: {
                    ...floor.customFields,
                    floorItemConfig: itemConfig,
                },
            });

            console.log(`  楼层 ${floor.name} (${floor.channel}) 已创建, 商品数: ${realProductIds.length}`);
        });
    }

    // 等待 apply-collection-filters 任务完成，否则 app.close() 会提前终止 worker，
    // 导致 collection 与 productVariant 的关联表为空（productVariants.items 返回空数组）
    console.log('  等待 apply-collection-filters 任务完成...');
    await waitForApplyFiltersJobs(app);
    console.log('  apply-collection-filters 任务已完成');
}
