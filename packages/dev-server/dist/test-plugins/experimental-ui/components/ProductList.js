"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductList = ProductList;
const jsx_runtime_1 = require("react/jsx-runtime");
const core_1 = require("@vendure/admin-ui/core");
const react_1 = require("@vendure/admin-ui/react");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const GET_PRODUCTS = (0, graphql_tag_1.default) `
    query GetProducts($skip: Int, $take: Int) {
        products(options: { skip: $skip, take: $take }) {
            items {
                id
                name
                enabled
            }
            totalItems
        }
    }
`;
const TOGGLE_ENABLED = (0, graphql_tag_1.default) `
    mutation ToggleEnabled($id: ID!, $enabled: Boolean!) {
        updateProduct(input: { id: $id, enabled: $enabled }) {
            id
            enabled
        }
    }
`;
function ProductList() {
    const { data, loading, error } = (0, react_1.useQuery)(GET_PRODUCTS, { skip: 0, take: 10 });
    const [toggleEnabled] = (0, react_1.useMutation)(TOGGLE_ENABLED);
    const notificationService = (0, react_1.useInjector)(core_1.NotificationService);
    function onToggle(id, enabled) {
        toggleEnabled({ id, enabled }).then(() => notificationService.success('Updated Product'), reason => notificationService.error(`Couldnt update product: ${reason}`));
    }
    if (loading || !data)
        return ((0, jsx_runtime_1.jsx)("div", { className: "page-block", children: (0, jsx_runtime_1.jsx)("h3", { children: "Loading..." }) }));
    if (error)
        return ((0, jsx_runtime_1.jsx)("div", { className: "page-block", children: (0, jsx_runtime_1.jsxs)("h3", { children: ["Error: ", error] }) }));
    const products = data.products;
    return products.items.length ? ((0, jsx_runtime_1.jsxs)("div", { className: "page-block", children: [(0, jsx_runtime_1.jsxs)("h3", { children: ["Found ", products.totalItems, " products, showing ", products.items.length, ":"] }), (0, jsx_runtime_1.jsxs)("table", { className: "table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "Toggle" }), (0, jsx_runtime_1.jsx)("th", { children: "State" }), (0, jsx_runtime_1.jsx)("th", { children: "Product" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: products.items.map((p, i) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("button", { className: "button-ghost", onClick: () => onToggle(p.id, !p.enabled), children: "Toggle" }) }), (0, jsx_runtime_1.jsx)("td", { children: p.enabled ? ((0, jsx_runtime_1.jsx)("span", { className: "label label-success", children: "Enabled" })) : ((0, jsx_runtime_1.jsx)("span", { className: "label label-danger", children: "Disabled" })) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)(react_1.Link, { href: `catalog/inventory/${p.id}`, className: "button-ghost", children: p.name }) })] }, i))) })] })] })) : ((0, jsx_runtime_1.jsx)("h3", { children: "Coudldn't find products." }));
}
//# sourceMappingURL=ProductList.js.map