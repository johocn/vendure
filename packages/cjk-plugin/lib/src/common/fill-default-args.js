"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillDefaultArgs = fillDefaultArgs;
/**
 * 把 operation（checker/handler）按定义补全缺失参数的 defaultValue。
 * - 幂等：只补缺失项，已传值不覆盖。
 * - 定义中无 defaultValue 且未传的参数不补，保持原样。
 * - 查不到对应 code 的定义时原样返回。
 */
function fillDefaultArgs(operation, defs) {
    var _a;
    if (operation == null)
        return null;
    const def = defs.find((d) => d.code === operation.code);
    if (!def)
        return operation;
    const existNames = new Set(operation.arguments.map((a) => a.name));
    const extra = [];
    for (const [name, argDef] of Object.entries((_a = def.args) !== null && _a !== void 0 ? _a : {})) {
        if (existNames.has(name))
            continue;
        if (argDef && argDef.defaultValue !== undefined) {
            extra.push({ name, value: String(argDef.defaultValue) });
        }
    }
    if (extra.length === 0)
        return operation;
    return Object.assign(Object.assign({}, operation), { arguments: [...operation.arguments, ...extra] });
}
//# sourceMappingURL=fill-default-args.js.map