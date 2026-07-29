/* eslint-disable no-console */
/**
 * 向运行中的 vendure 添加自提点测试数据（不重新 populate）
 * 用法: node -r ts-node/register -r dotenv/config -r tsconfig-paths/register add-pickup-locations.ts
 *
 * 补充到每种类型至少 5 条：
 * - store（门店自提）：现有 3 条，补充 2 条
 * - point（菜鸟驿站）：现有 2 条，补充 3 条
 * - employee（企业职工自提）：现有 1 条，补充 4 条
 */
import { bootstrap, Logger } from '@vendure/core';
import { PickupLocationService } from '@vendure/cjk-plugin';
import { devConfig } from './dev-config';

interface PickupSource {
    name: string;
    type: 'store' | 'point' | 'employee';
    address: string;
    phoneNumber: string;
    businessHours: string;
    coordinates: { lat: number; lng: number };
    isPublic?: boolean;
}

// 以双阳区为中心，周边生成自提点（与现有数据坐标接近，便于距离排序测试）
const NEW_PICKUP_LOCATIONS: PickupSource[] = [
    // ===== store 门店自提（补充2条，达到5条）=====
    {
        name: '双阳欧亚商场店',
        type: 'store',
        address: '吉林省长春市双阳区嵩山路99号',
        phoneNumber: '0431-84223001',
        businessHours: '08:30-21:00',
        coordinates: { lat: 43.527010, lng: 125.662100 },
    },
    {
        name: '双阳商贸城店',
        type: 'store',
        address: '吉林省长春市双阳区东双阳大街288号',
        phoneNumber: '0431-84223002',
        businessHours: '08:00-20:00',
        coordinates: { lat: 43.524580, lng: 125.667850 },
    },

    // ===== point 菜鸟驿站（补充3条，达到5条）=====
    {
        name: '菜鸟驿站(双阳华昌店)',
        type: 'point',
        address: '吉林省长春市双阳区华昌路50号',
        phoneNumber: '0431-84223003',
        businessHours: '08:00-21:00',
        coordinates: { lat: 43.529100, lng: 125.663500 },
    },
    {
        name: '菜鸟驿站(双阳站前店)',
        type: 'point',
        address: '吉林省长春市双阳区站前路18号',
        phoneNumber: '0431-84223004',
        businessHours: '08:00-22:00',
        coordinates: { lat: 43.530550, lng: 125.669200 },
    },
    {
        name: '菜鸟驿站(双阳清江店)',
        type: 'point',
        address: '吉林省长春市双阳区清江路66号',
        phoneNumber: '0431-84223005',
        businessHours: '08:30-21:30',
        coordinates: { lat: 43.525120, lng: 125.671800 },
    },

    // ===== employee 企业职工自提（补充4条，达到5条）=====
    {
        name: '吉林农业大学自提点',
        type: 'employee',
        address: '吉林省长春市双阳区新城大街2888号',
        phoneNumber: '0431-84223006',
        businessHours: '08:00-18:00',
        coordinates: { lat: 43.531120, lng: 125.679840 },
        isPublic: true,
    },
    {
        name: '长春大学自提点',
        type: 'employee',
        address: '吉林省长春市双阳区大学城路1号',
        phoneNumber: '0431-84223007',
        businessHours: '08:00-17:30',
        coordinates: { lat: 43.534200, lng: 125.673500 },
        isPublic: true,
    },
    {
        name: '双阳经济开发区自提点',
        type: 'employee',
        address: '吉林省长春市双阳区经济开发区创业路88号',
        phoneNumber: '0431-84223008',
        businessHours: '08:30-17:00',
        coordinates: { lat: 43.522300, lng: 125.675100 },
        isPublic: true,
    },
    {
        name: '长春职业技术学院自提点',
        type: 'employee',
        address: '吉林省长春市双阳区职教路66号',
        phoneNumber: '0431-84223009',
        businessHours: '08:00-18:00',
        coordinates: { lat: 43.528800, lng: 125.678200 },
        isPublic: true,
    },
];

if (require.main === module) {
    bootstrap(devConfig)
        .then(async app => {
            const pickupLocationService = app.get(PickupLocationService);

            // 获取 default channel 的 RequestContext
            const { RequestContextService } = await import('@vendure/core');
            const requestContextService = app.get(RequestContextService);

            const ctx = await requestContextService.create({
                apiType: 'admin',
                channelOrToken: 'default-token',
            });

            console.log(`\n开始添加 ${NEW_PICKUP_LOCATIONS.length} 个自提点到 default channel...`);

            let created = 0;
            let skipped = 0;

            for (const loc of NEW_PICKUP_LOCATIONS) {
                try {
                    // 检查是否已存在同名自提点（避免重复）
                    const existing = await pickupLocationService.findAll(ctx, {
                        filter: { name: { contains: loc.name } },
                        take: 1,
                    });
                    if (existing.totalItems > 0) {
                        console.log(`  [跳过] ${loc.name} (已存在)`);
                        skipped++;
                        continue;
                    }

                    await pickupLocationService.create(ctx, {
                        name: loc.name,
                        type: loc.type,
                        address: loc.address,
                        phoneNumber: loc.phoneNumber,
                        businessHours: loc.businessHours,
                        coordinates: loc.coordinates,
                        isPublic: loc.isPublic ?? false,
                    } as any);
                    console.log(`  [创建] ${loc.name} (${loc.type})`);
                    created++;
                } catch (e: any) {
                    console.error(`  [失败] ${loc.name}: ${e.message}`);
                }
            }

            console.log(`\n完成! 新建 ${created} 个，跳过 ${skipped} 个`);

            // 统计各类型总数
            const allLocs = await pickupLocationService.findAll(ctx, { take: 100 });
            const byType = allLocs.items.reduce((acc, l) => {
                acc[l.type] = (acc[l.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            console.log('当前 default channel 自提点统计:');
            console.log(`  store (门店自提): ${byType['store'] || 0} 条`);
            console.log(`  point (菜鸟驿站): ${byType['point'] || 0} 条`);
            console.log(`  employee (企业职工): ${byType['employee'] || 0} 条`);
            console.log(`  总计: ${allLocs.totalItems} 条`);

            await app.close();
            process.exit(0);
        })
        .catch(err => {
            console.error('启动失败:', err);
            process.exit(1);
        });
}
