"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTemplateConfig = parseTemplateConfig;
const SLOT_ROLES = ['main', 'secondary', 'spacer', 'focal', 'decor'];
const QUANTITY_MODES = ['calculated', 'fixed', 'user'];
/**
 * 解析模板 config jsonb（规格 §5.2/§8）：
 * - 坏结构 / 缺关键字段（slots 非空数组且每个 slot 有 key/role/quantityMode/required、
 *   presentation.renderer 非空字符串）→ null，调用方逐级回退；
 * - params / constraints / presentation.blocks 缺省宽松补 []。
 */
function parseTemplateConfig(input) {
    if (input == null || typeof input !== 'object' || Array.isArray(input)) {
        return null;
    }
    const raw = input;
    if (!Array.isArray(raw.slots) || raw.slots.length === 0) {
        return null;
    }
    const slots = [];
    for (const item of raw.slots) {
        if (item == null || typeof item !== 'object' || Array.isArray(item)) {
            return null;
        }
        const s = item;
        if (typeof s.key !== 'string' || s.key === '')
            return null;
        if (typeof s.role !== 'string' || !SLOT_ROLES.includes(s.role))
            return null;
        if (typeof s.quantityMode !== 'string' || !QUANTITY_MODES.includes(s.quantityMode))
            return null;
        if (typeof s.required !== 'boolean')
            return null;
        slots.push(s);
    }
    if (raw.presentation == null || typeof raw.presentation !== 'object' || Array.isArray(raw.presentation)) {
        return null;
    }
    const renderer = raw.presentation.renderer;
    if (typeof renderer !== 'string' || renderer === '') {
        return null;
    }
    const blocks = raw.presentation.blocks;
    const presentation = {
        renderer,
        blocks: Array.isArray(blocks) ? blocks : [],
    };
    const params = Array.isArray(raw.params) ? raw.params : [];
    const constraints = Array.isArray(raw.constraints) ? raw.constraints : [];
    return { slots, params, constraints, presentation };
}
//# sourceMappingURL=template-config.js.map