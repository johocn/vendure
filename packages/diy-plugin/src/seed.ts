import { Logger, TransactionalConnection } from '@vendure/core';

import { loggerCtx } from './constants';
import { DiyCategory } from './entities/diy-category.entity';

const SEED_CATEGORIES: Array<{ code: string; name: Record<string, string> }> = [
    { code: 'crystal', name: { 'zh-CN': '水晶', 'en-US': 'Crystal' } },
    { code: 'agate', name: { 'zh-CN': '玛瑙玉髓', 'en-US': 'Agate & Chalcedony' } },
    { code: 'wood', name: { 'zh-CN': '木质', 'en-US': 'Wood' } },
    { code: 'amber', name: { 'zh-CN': '蜜蜡琉璃', 'en-US': 'Amber & Glass' } },
    { code: 'pearl', name: { 'zh-CN': '珍珠贝珠', 'en-US': 'Pearl & Shell' } },
    { code: 'metal', name: { 'zh-CN': '金属配件', 'en-US': 'Metal' } },
    { code: 'gemstone', name: { 'zh-CN': '天然宝石', 'en-US': 'Gemstone' } },
];

/** 幂等种子：平台分类（app=null） */
export async function seedDiy(connection: TransactionalConnection): Promise<void> {
    const repo = connection.getRepository(DiyCategory);
    for (const [i, c] of SEED_CATEGORIES.entries()) {
        const existing = await repo.findOne({ where: { app: null as any, code: c.code } });
        if (!existing) {
            await repo.save(
                new DiyCategory({ app: null, code: c.code, name: c.name, sortOrder: i, enabled: true }),
            );
        }
    }
    Logger.info('[DiyPlugin] platform categories seeded', loggerCtx);
}
