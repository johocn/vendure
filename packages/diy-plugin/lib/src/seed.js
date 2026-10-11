"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDiy = seedDiy;
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const diy_category_entity_1 = require("./entities/diy-category.entity");
const SEED_CATEGORIES = [
    { code: 'crystal', name: { 'zh-CN': '水晶', 'en-US': 'Crystal' } },
    { code: 'agate', name: { 'zh-CN': '玛瑙玉髓', 'en-US': 'Agate & Chalcedony' } },
    { code: 'wood', name: { 'zh-CN': '木质', 'en-US': 'Wood' } },
    { code: 'amber', name: { 'zh-CN': '蜜蜡琉璃', 'en-US': 'Amber & Glass' } },
    { code: 'pearl', name: { 'zh-CN': '珍珠贝珠', 'en-US': 'Pearl & Shell' } },
    { code: 'metal', name: { 'zh-CN': '金属配件', 'en-US': 'Metal' } },
    { code: 'gemstone', name: { 'zh-CN': '天然宝石', 'en-US': 'Gemstone' } },
];
/** 幂等种子：平台分类（app=null） */
async function seedDiy(connection) {
    const repo = connection.getRepository(diy_category_entity_1.DiyCategory);
    for (const [i, c] of SEED_CATEGORIES.entries()) {
        const existing = await repo.findOne({ where: { app: null, code: c.code } });
        if (!existing) {
            await repo.save(new diy_category_entity_1.DiyCategory({ app: null, code: c.code, name: c.name, sortOrder: i, enabled: true }));
        }
    }
    core_1.Logger.info('[DiyPlugin] platform categories seeded', constants_1.loggerCtx);
}
//# sourceMappingURL=seed.js.map