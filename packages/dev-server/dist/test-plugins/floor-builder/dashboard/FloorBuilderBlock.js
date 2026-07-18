"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FloorBuilderBlock = FloorBuilderBlock;
const jsx_runtime_1 = require("react/jsx-runtime");
const dashboard_1 = require("@vendure/dashboard");
function FloorBuilderBlock() {
    var _a, _b, _c, _d;
    const page = (0, dashboard_1.usePage)();
    const entity = page === null || page === void 0 ? void 0 : page.entity;
    // 读取当前 Collection 的 customFields
    const floorItemConfig = ((_a = entity === null || entity === void 0 ? void 0 : entity.customFields) === null || _a === void 0 ? void 0 : _a.floorItemConfig) || [];
    const productVariants = ((_b = entity === null || entity === void 0 ? void 0 : entity.productVariants) === null || _b === void 0 ? void 0 : _b.items) || [];
    // 预览：根据 floorLayout 渲染不同布局
    const floorLayout = ((_c = entity === null || entity === void 0 ? void 0 : entity.customFields) === null || _c === void 0 ? void 0 : _c.floorLayout) || 'double_grid';
    const floorTitle = ((_d = entity === null || entity === void 0 ? void 0 : entity.customFields) === null || _d === void 0 ? void 0 : _d.floorTitle) || (entity === null || entity === void 0 ? void 0 : entity.name) || '';
    if (!entity) {
        return (0, jsx_runtime_1.jsx)("div", { className: "p-4 text-gray-500", children: "\u8BF7\u5148\u4FDD\u5B58 Collection" });
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 p-4", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold", children: "\u697C\u5C42\u642D\u5EFA\u5668" }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded border p-4 bg-gray-50", children: [(0, jsx_runtime_1.jsxs)("h4", { className: "text-sm font-medium mb-2", children: ["\u5B9E\u65F6\u9884\u89C8\uFF08", floorLayout, "\uFF09"] }), (0, jsx_runtime_1.jsxs)("div", { className: "bg-white rounded p-2", style: { maxWidth: '375px', margin: '0 auto' }, children: [(0, jsx_runtime_1.jsx)("div", { className: "font-bold text-sm mb-2", children: floorTitle }), (0, jsx_runtime_1.jsx)(PreviewGrid, { layout: floorLayout, items: productVariants.slice(0, 6), itemConfig: floorItemConfig })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-sm text-gray-600", children: [(0, jsx_runtime_1.jsx)("p", { children: "\u5546\u54C1\u9009\u54C1\uFF1A\u5728\u4E0A\u65B9 \"Contents\" \u533A\u57DF\u4F7F\u7528 product-id-filter \u6DFB\u52A0\u5546\u54C1" }), (0, jsx_runtime_1.jsx)("p", { children: "\u5916\u89C2\u914D\u7F6E\uFF1A\u5728\u4E0B\u65B9 \"Custom fields\" \u533A\u57DF\u914D\u7F6E floorLayout\u3001floorTheme\u3001floorItemConfig" }), (0, jsx_runtime_1.jsx)("p", { children: "floorItemConfig \u4E2D\u7684 productId \u5FC5\u987B\u4E0E Contents \u4E2D\u7684\u5546\u54C1 ID \u4E00\u81F4" })] })] }));
}
function PreviewGrid({ layout, items, itemConfig }) {
    var _a, _b, _c;
    const cols = layout === 'triple_grid' ? 3 : layout === 'double_grid' ? 2 : layout === 'single_scroll' ? 1 : 2;
    if (layout === 'hero_with_list' && items.length > 0) {
        return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-gray-200 h-32 rounded mb-2 flex items-center justify-center", children: (0, jsx_runtime_1.jsx)("img", { src: (_c = (_b = (_a = items[0]) === null || _a === void 0 ? void 0 : _a.product) === null || _b === void 0 ? void 0 : _b.featuredAsset) === null || _c === void 0 ? void 0 : _c.preview, alt: "", className: "max-h-full" }) }), (0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-2", children: items.slice(1, 5).map(v => { var _a; return (0, jsx_runtime_1.jsx)(PreviewItem, { name: (_a = v.product) === null || _a === void 0 ? void 0 : _a.name }, v.id); }) })] }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: "grid gap-2", style: { gridTemplateColumns: `repeat(${cols}, 1fr)` }, children: items.map(v => { var _a; return (0, jsx_runtime_1.jsx)(PreviewItem, { name: (_a = v.product) === null || _a === void 0 ? void 0 : _a.name }, v.id); }) }));
}
function PreviewItem({ name }) {
    return ((0, jsx_runtime_1.jsxs)("div", { className: "bg-gray-100 rounded p-2 text-center", children: [(0, jsx_runtime_1.jsx)("div", { className: "bg-gray-200 h-16 rounded mb-1" }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs truncate", children: name || '商品名' })] }));
}
//# sourceMappingURL=FloorBuilderBlock.js.map