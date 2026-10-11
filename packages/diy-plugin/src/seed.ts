import { Logger, TransactionalConnection } from '@vendure/core';
import { IsNull } from 'typeorm';

import { loggerCtx } from './constants';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyTemplateConfig } from './types';

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
    await seedBraceletTemplate(connection);
}

export const BRACELET_CLASSIC: DiyTemplateConfig = {
    slots: [
        {
            key: 'main',
            name: { 'zh-CN': '主珠', 'en-US': 'Main beads' },
            role: 'main',
            required: true,
            quantityMode: 'calculated',
            filter: { shapes: ['round'], diameterRange: [4, 16] },
        },
        {
            key: 'focal',
            name: { 'zh-CN': '焦点珠', 'en-US': 'Focal bead' },
            role: 'focal',
            required: false,
            quantityMode: 'fixed',
            quantity: 1,
            filter: { shapes: ['round', 'drum'], diameterRange: [10, 20] },
        },
        {
            key: 'spacer',
            name: { 'zh-CN': '隔片', 'en-US': 'Spacers' },
            role: 'spacer',
            required: false,
            quantityMode: 'user',
            quantityRange: [0, 40],
            defaultEvery: 2,
            filter: { shapes: ['spacer'] },
        },
    ],
    params: [
        { key: 'wristSize', type: 'number', unit: 'mm', min: 120, max: 200, default: 155 },
        { key: 'fit', type: 'enum', options: ['snug', 'comfortable', 'loose'], default: 'comfortable' },
        { key: 'gap', type: 'number', unit: 'mm', min: 0, max: 2, default: 0.5, advanced: true },
    ],
    constraints: [],
    presentation: { renderer: 'bracelet', blocks: ['gallery', 'params', 'slots', 'price'] },
};

async function seedBraceletTemplate(connection: TransactionalConnection): Promise<void> {
    const repo = connection.getRepository(DiyTemplate);
    const existing = await repo.findOne({ where: { app: IsNull(), code: 'bracelet-classic' } });
    if (existing) {
        return;
    }
    await repo.save(
        new DiyTemplate({
            app: null,
            code: 'bracelet-classic',
            name: { 'zh-CN': '经典手串', 'en-US': 'Classic bracelet' },
            description: {
                'zh-CN': '圆珠 + 焦点珠 + 隔片的标准手串玩法',
                'en-US': 'Standard bracelet with focal bead and spacers',
            },
            calculatorKey: 'bracelet',
            config: BRACELET_CLASSIC,
            status: 'enabled',
            version: 1,
            sortOrder: 0,
        }),
    );
    Logger.info('[DiyPlugin] bracelet-classic template seeded', loggerCtx);
}
