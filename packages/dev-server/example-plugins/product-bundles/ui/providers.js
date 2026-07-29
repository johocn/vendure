"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/admin-ui/core");
exports.default = [
    (0, core_1.addNavMenuItem)({
        id: 'product-bundles',
        label: 'Product Bundles',
        routerLink: ['/extensions/product-bundles'],
        icon: '',
    }, 'catalog'),
];
//# sourceMappingURL=providers.js.map