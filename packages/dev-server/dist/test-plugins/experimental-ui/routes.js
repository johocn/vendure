"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("@vendure/admin-ui/react");
const Greeter_1 = require("./components/Greeter");
const ProductList_1 = require("./components/ProductList");
exports.default = [
    (0, react_1.registerReactRouteComponent)({
        component: Greeter_1.Greeter,
        path: ':name',
        title: 'Greeter Page',
        breadcrumb: 'Greeter',
        props: {
            name: 'World',
        },
    }),
    (0, react_1.registerReactRouteComponent)({
        component: ProductList_1.ProductList,
        path: 'products',
        title: 'Products',
        breadcrumb: 'Products',
    }),
];
//# sourceMappingURL=routes.js.map