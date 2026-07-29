"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/admin-ui/core");
const product_bundle_list_component_1 = require("./components/product-bundle-list/product-bundle-list.component");
exports.default = [
    (0, core_1.registerRouteComponent)({
        path: '',
        component: product_bundle_list_component_1.ProductBundleListComponent,
        breadcrumb: 'Product bundles',
    }),
];
//# sourceMappingURL=routes.js.map