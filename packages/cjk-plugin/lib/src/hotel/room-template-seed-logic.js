"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSeedActions = resolveSeedActions;
exports.seedsToInsertInputs = seedsToInsertInputs;
const room_template_seeds_1 = require("./room-template-seeds");
/**
 * 决定哪些种子需要插入。
 * rule: 已存在(同名 code) → 跳过；被客户删除(control.deleted) → 跳过且不补回；否则 → 插入。
 * 纯函数，便于单测。
 */
function resolveSeedActions(existingCodes, deletedCodes) {
    return room_template_seeds_1.ROOM_TEMPLATE_SEEDS.filter((s) => !existingCodes.has(s.code) && !deletedCodes.has(s.code));
}
/** 由待插入种子生成完整模板实体输入。 */
function seedsToInsertInputs(seeds) {
    return seeds.map(room_template_seeds_1.buildSeedTemplate);
}
//# sourceMappingURL=room-template-seed-logic.js.map