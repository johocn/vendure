"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlugWithLink = SlugWithLink;
const jsx_runtime_1 = require("react/jsx-runtime");
function SlugWithLink({ rowItem }) {
    const slug = rowItem.slug;
    return ((0, jsx_runtime_1.jsx)("a", { href: `https://example.com/category/${slug}`, target: "_blank", children: slug }));
}
//# sourceMappingURL=SlugWithLink.js.map