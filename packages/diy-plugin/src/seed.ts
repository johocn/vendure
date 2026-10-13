import { Logger, TransactionalConnection } from '@vendure/core';
import { IsNull } from 'typeorm';

import { loggerCtx } from './constants';
import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyTemplateConfig, LocalizedText } from './types';

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
    await seedDecorMaterials(connection);
    await enrichBeadMaterials(connection);
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

/** 平台配饰/隔片素材种子（app=null；幂等按 code 查重；price 单位分） */
interface SeedMaterial {
    code: string;
    name: LocalizedText;
    categoryCode: string;
    shape: string;
    diameter: number;
    axialLength: number;
    holeSize: number;
    /** attrs.decor=true 统一进 C 端配饰 tab；kind 分流 spacer 串入环上 / pendant·charm 挂环外 */
    attrs: Record<string, any>;
    renderPreset: string;
    price: number;
    meaning: LocalizedText;
    origin: LocalizedText;
    hardness: string;
}

const SEED_DECOR_MATERIALS: SeedMaterial[] = [
    // —— 隔片 ×6（串入环上当小珠，算量按 diameter/axialLength）——
    { code: 'SP-AGS-04-N', name: { 'zh-CN': '纯银圆隔片', 'en-US': 'Silver round spacer' }, categoryCode: 'metal', shape: 'spacer', diameter: 4, axialLength: 1.5, holeSize: 1, attrs: { decor: true, kind: 'spacer', group: 'silver', color: '#C0C4CC' }, renderPreset: 'metal', price: 300, meaning: { 'zh-CN': '素银点缀，串联层次', 'en-US': 'Sterling accents between beads' }, origin: { 'zh-CN': '广东番禺', 'en-US': 'Panyu, Guangdong' }, hardness: '2.5-3' },
    { code: 'SP-AGS-06-F', name: { 'zh-CN': '纯银平片', 'en-US': 'Silver flat disc' }, categoryCode: 'metal', shape: 'spacer', diameter: 6, axialLength: 1, holeSize: 1, attrs: { decor: true, kind: 'spacer', group: 'silver', color: '#C0C4CC' }, renderPreset: 'metal', price: 400, meaning: { 'zh-CN': '线面分隔，干净利落', 'en-US': 'Clean flat separation' }, origin: { 'zh-CN': '广东番禺', 'en-US': 'Panyu, Guangdong' }, hardness: '2.5-3' },
    { code: 'SP-BGS-04-N', name: { 'zh-CN': '镀金圆隔片', 'en-US': 'Gold round spacer' }, categoryCode: 'metal', shape: 'spacer', diameter: 4, axialLength: 1.5, holeSize: 1, attrs: { decor: true, kind: 'spacer', group: 'silver', color: '#C8A23A' }, renderPreset: 'metal', price: 200, meaning: { 'zh-CN': '金韵映彩，贵气点睛', 'en-US': 'Warm gold highlight' }, origin: { 'zh-CN': '广东番禺', 'en-US': 'Panyu, Guangdong' }, hardness: '2.5-3' },
    { code: 'SP-BGS-06-F', name: { 'zh-CN': '镀金平片', 'en-US': 'Gold flat disc' }, categoryCode: 'metal', shape: 'spacer', diameter: 6, axialLength: 1, holeSize: 1, attrs: { decor: true, kind: 'spacer', group: 'silver', color: '#C8A23A' }, renderPreset: 'metal', price: 300, meaning: { 'zh-CN': '金线分隔，古法质感', 'en-US': 'Gold flat separator' }, origin: { 'zh-CN': '广东番禺', 'en-US': 'Panyu, Guangdong' }, hardness: '2.5-3' },
    { code: 'SP-WOD-06-N', name: { 'zh-CN': '黑檀隔珠', 'en-US': 'Ebony spacer' }, categoryCode: 'wood', shape: 'spacer', diameter: 6, axialLength: 2, holeSize: 1.5, attrs: { decor: true, kind: 'spacer', group: 'wood', color: '#6B4A32' }, renderPreset: 'wood', price: 100, meaning: { 'zh-CN': '沉稳护身，静心安神', 'en-US': 'Grounding & calm' }, origin: { 'zh-CN': '印度', 'en-US': 'India' }, hardness: '约2' },
    { code: 'SP-GMS-05-N', name: { 'zh-CN': '松石隔片', 'en-US': 'Turquoise spacer' }, categoryCode: 'gemstone', shape: 'spacer', diameter: 5, axialLength: 2, holeSize: 1, attrs: { decor: true, kind: 'spacer', group: 'gemstone', color: '#4A9B8E' }, renderPreset: 'jade', price: 300, meaning: { 'zh-CN': '平安顺利，好运相随', 'en-US': 'Safety & good luck' }, origin: { 'zh-CN': '湖北十堰', 'en-US': 'Shiyan, Hubei' }, hardness: '5-6' },
    // —— 挂坠 ×4（挂环外，可拖拽/删除）——
    { code: 'PD-GMS-12-N', name: { 'zh-CN': '翡翠平安扣', 'en-US': 'Jade safety coin' }, categoryCode: 'gemstone', shape: 'pendant', diameter: 12, axialLength: 3, holeSize: 2, attrs: { decor: true, kind: 'pendant', group: 'gemstone', color: '#3E8E62' }, renderPreset: 'jade-flower', price: 5900, meaning: { 'zh-CN': '平安如意，护佑随行', 'en-US': 'Safety & blessing' }, origin: { 'zh-CN': '缅甸', 'en-US': 'Myanmar' }, hardness: '6.5-7' },
    { code: 'PD-AMB-10-N', name: { 'zh-CN': '蜜蜡水滴坠', 'en-US': 'Amber teardrop' }, categoryCode: 'amber', shape: 'pendant', diameter: 10, axialLength: 5, holeSize: 1.5, attrs: { decor: true, kind: 'pendant', group: 'amber', color: '#DBA85B' }, renderPreset: 'amber', price: 3900, meaning: { 'zh-CN': '温润宁神，岁月流光', 'en-US': 'Warm serenity' }, origin: { 'zh-CN': '波罗的海', 'en-US': 'Baltic Sea' }, hardness: '2-2.5' },
    { code: 'PD-AGS-08-N', name: { 'zh-CN': '纯银铃铛', 'en-US': 'Silver bell' }, categoryCode: 'metal', shape: 'pendant', diameter: 8, axialLength: 8, holeSize: 2, attrs: { decor: true, kind: 'pendant', group: 'silver', color: '#C0C4CC' }, renderPreset: 'metal', price: 1500, meaning: { 'zh-CN': '铃音清越，驱烦致静', 'en-US': 'Clear ring, calm mind' }, origin: { 'zh-CN': '广东番禺', 'en-US': 'Panyu, Guangdong' }, hardness: '2.5-3' },
    { code: 'PD-CRY-10-N', name: { 'zh-CN': '粉晶爱心坠', 'en-US': 'Rose quartz heart' }, categoryCode: 'crystal', shape: 'pendant', diameter: 10, axialLength: 6, holeSize: 1.5, attrs: { decor: true, kind: 'pendant', group: 'crystal-pink', color: '#D98BA0' }, renderPreset: 'glass', price: 1900, meaning: { 'zh-CN': '姻缘和合，温柔待人', 'en-US': 'Love & gentleness' }, origin: { 'zh-CN': '马达加斯加', 'en-US': 'Madagascar' }, hardness: '7' },
    // —— 装饰珠 ×5（挂环外，可拖拽/删除）——
    { code: 'CM-BGS-06-N', name: { 'zh-CN': '镀金转运珠', 'en-US': 'Gold luck bead' }, categoryCode: 'metal', shape: 'charm', diameter: 6, axialLength: 4, holeSize: 2, attrs: { decor: true, kind: 'charm', group: 'silver', color: '#C8A23A' }, renderPreset: 'metal', price: 800, meaning: { 'zh-CN': '时来运转，好运连连', 'en-US': 'Luck turns around' }, origin: { 'zh-CN': '广东番禺', 'en-US': 'Panyu, Guangdong' }, hardness: '2.5-3' },
    { code: 'CM-AGS-06-N', name: { 'zh-CN': '纯银配珠', 'en-US': 'Silver charm bead' }, categoryCode: 'metal', shape: 'charm', diameter: 6, axialLength: 4, holeSize: 2, attrs: { decor: true, kind: 'charm', group: 'silver', color: '#C0C4CC' }, renderPreset: 'metal', price: 1000, meaning: { 'zh-CN': '素银映彩，简约百搭', 'en-US': 'Minimal silver accent' }, origin: { 'zh-CN': '广东番禺', 'en-US': 'Panyu, Guangdong' }, hardness: '2.5-3' },
    { code: 'CM-PEA-08-N', name: { 'zh-CN': '贝珠配珠', 'en-US': 'Shell pearl charm' }, categoryCode: 'pearl', shape: 'charm', diameter: 8, axialLength: 5, holeSize: 1.5, attrs: { decor: true, kind: 'charm', group: 'pearl', color: '#EDE4E0' }, renderPreset: 'pearl', price: 500, meaning: { 'zh-CN': '珠圆玉润，圆满相随', 'en-US': 'Wholeness & grace' }, origin: { 'zh-CN': '浙江诸暨', 'en-US': 'Zhuji, Zhejiang' }, hardness: '2.5-4.5' },
    { code: 'CM-GLA-06-N', name: { 'zh-CN': '珐琅蓝珠', 'en-US': 'Enamel blue bead' }, categoryCode: 'amber', shape: 'charm', diameter: 6, axialLength: 4, holeSize: 1.5, attrs: { decor: true, kind: 'charm', group: 'amber', color: '#2E6BC4' }, renderPreset: 'glass', price: 600, meaning: { 'zh-CN': '湛蓝如海，灵动明快', 'en-US': 'Ocean blue sparkle' }, origin: { 'zh-CN': '江西景德镇', 'en-US': 'Jingdezhen, Jiangxi' }, hardness: '约5' },
    { code: 'CM-GMS-08-N', name: { 'zh-CN': '朱砂圆坠', 'en-US': 'Cinnabar charm' }, categoryCode: 'gemstone', shape: 'charm', diameter: 8, axialLength: 5, holeSize: 1.5, attrs: { decor: true, kind: 'charm', group: 'gemstone', color: '#B5451F' }, renderPreset: 'matte', price: 1200, meaning: { 'zh-CN': '朱红辟邪，喜气盈门', 'en-US': 'Red protection & joy' }, origin: { 'zh-CN': '湖南张家界', 'en-US': 'Zhangjiajie, Hunan' }, hardness: '2-2.5' },
];

/** 幂等种入平台配饰素材；缺分类码时跳过并告警（不中断模板 seed） */
export async function seedDecorMaterials(connection: TransactionalConnection): Promise<void> {
    const repo = connection.getRepository(DiyMaterial);
    const catRepo = connection.getRepository(DiyCategory);
    const cats = await catRepo.find({ where: { app: IsNull() as any } });
    const catId = (code: string) => { const c = cats.find(x => x.code === code); return c ? Number(c.id) : undefined; };
    let inserted = 0;
    for (const m of SEED_DECOR_MATERIALS) {
        const exists = await repo.findOne({ where: { app: IsNull() as any, code: m.code } });
        if (exists) {
            continue;
        }
        const categoryId = catId(m.categoryCode);
        if (!categoryId) {
            Logger.warn(`[DiyPlugin] seed material ${m.code}: category ${m.categoryCode} not found, skipped`, loggerCtx);
            continue;
        }
        await repo.save(
            new DiyMaterial({
                app: null,
                code: m.code,
                name: m.name,
                categoryId,
                shape: m.shape,
                diameter: m.diameter,
                axialLength: m.axialLength,
                holeSize: m.holeSize,
                attrs: { ...m.attrs, meaning: m.meaning, origin: m.origin, hardness: m.hardness },
                render: { preset: m.renderPreset, color: m.attrs.color },
                renderPreset: m.renderPreset,
                price: m.price,
                priceUnit: 'piece',
                currency: 'CNY',
                stock: 999,
                enabled: true,
                sortOrder: 100,
            }),
        );
        inserted++;
    }
    Logger.info(`[DiyPlugin] decor materials seeded (${inserted} inserted)`, loggerCtx);
}

/**
 * 现有圆珠素材 attrs 详情增补（meaning/origin/hardness 按 group 通用文案；已有则跳过）。
 * 分类归属无需迁移：现有 group↔categoryId 已一一对应（实测 cat1-crystal / cat2-agate /
 * cat3-wood / cat4-amber / cat5-pearl），金属与宝石类由配饰 seed 填充。
 */
const GROUP_DETAIL: Record<string, { meaning: LocalizedText; origin: LocalizedText; hardness: string }> = {
    'crystal-white': { meaning: { 'zh-CN': '净化身心，提升专注', 'en-US': 'Purifying & focus' }, origin: { 'zh-CN': '江苏东海', 'en-US': 'Donghai, Jiangsu' }, hardness: '7' },
    'crystal-purple': { meaning: { 'zh-CN': '智慧之石，启迪灵感', 'en-US': 'Stone of wisdom' }, origin: { 'zh-CN': '乌拉圭', 'en-US': 'Uruguay' }, hardness: '7' },
    'crystal-yellow': { meaning: { 'zh-CN': '财富之石，招财纳福', 'en-US': 'Stone of wealth' }, origin: { 'zh-CN': '巴西', 'en-US': 'Brazil' }, hardness: '7' },
    'crystal-black': { meaning: { 'zh-CN': '辟邪护身，沉稳大气', 'en-US': 'Protection & poise' }, origin: { 'zh-CN': '巴西', 'en-US': 'Brazil' }, hardness: '7' },
    'agate-red': { meaning: { 'zh-CN': '鸿运当头，热情活力', 'en-US': 'Fortune & vitality' }, origin: { 'zh-CN': '四川凉山', 'en-US': 'Liangshan, Sichuan' }, hardness: '6.5-7' },
    'agate-green': { meaning: { 'zh-CN': '生机盎然，安神定气', 'en-US': 'Vitality & calm' }, origin: { 'zh-CN': '巴西', 'en-US': 'Brazil' }, hardness: '6.5-7' },
    'agate-tiger': { meaning: { 'zh-CN': '勇毅进取，虎虎生威', 'en-US': 'Courage & drive' }, origin: { 'zh-CN': '南非', 'en-US': 'South Africa' }, hardness: '7' },
    'wood-zitan': { meaning: { 'zh-CN': '安神静心，温润养性', 'en-US': 'Calming & nourishing' }, origin: { 'zh-CN': '印度', 'en-US': 'India' }, hardness: '约2' },
    'wood-huanghua': { meaning: { 'zh-CN': '吉祥富贵，纹理天成', 'en-US': 'Prosperity & grace' }, origin: { 'zh-CN': '海南', 'en-US': 'Hainan' }, hardness: '约2' },
    'amber-yellow': { meaning: { 'zh-CN': '宁神纳福，岁月流光', 'en-US': 'Serenity & blessing' }, origin: { 'zh-CN': '波罗的海', 'en-US': 'Baltic Sea' }, hardness: '2-2.5' },
    'amber-blue': { meaning: { 'zh-CN': '辟邪纳福，稀有珍贵', 'en-US': 'Protection & rarity' }, origin: { 'zh-CN': '多米尼加', 'en-US': 'Dominican Republic' }, hardness: '2-2.5' },
    'pearl-fresh': { meaning: { 'zh-CN': '圆润圆满，温婉相随', 'en-US': 'Wholeness & grace' }, origin: { 'zh-CN': '淡水湖', 'en-US': 'Freshwater lakes' }, hardness: '2.5-4.5' },
    'pearl-tahiti': { meaning: { 'zh-CN': '神秘优雅，独立自信', 'en-US': 'Mystery & confidence' }, origin: { 'zh-CN': '大溪地', 'en-US': 'Tahiti' }, hardness: '2.5-4.5' },
};

/** 幂等增补现有素材 attrs 详情字段（meaning 已存在则跳过该条） */
export async function enrichBeadMaterials(connection: TransactionalConnection): Promise<void> {
    const repo = connection.getRepository(DiyMaterial);
    const rows = await repo.find({ where: { app: IsNull() as any } });
    let updated = 0;
    for (const row of rows) {
        const group = row.attrs?.group;
        const detail = group ? GROUP_DETAIL[group] : undefined;
        if (!detail || row.attrs?.meaning) {
            continue;
        }
        row.attrs = { ...row.attrs, meaning: detail.meaning, origin: detail.origin, hardness: detail.hardness };
        await repo.save(row);
        updated++;
    }
    Logger.info(`[DiyPlugin] bead materials enriched (${updated} updated)`, loggerCtx);
}
