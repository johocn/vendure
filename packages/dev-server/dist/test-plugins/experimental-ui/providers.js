"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/admin-ui/core");
const react_1 = require("@vendure/admin-ui/react");
const CustomDetailComponent_1 = require("./components/CustomDetailComponent");
const slug_with_link_component_1 = require("./components/slug-with-link.component");
const SlugWithLink_1 = require("./components/SlugWithLink");
const cms_data_service_1 = require("./providers/cms-data.service");
exports.default = [
    cms_data_service_1.CmsDataService,
    (0, core_1.registerDataTableComponent)({
        component: slug_with_link_component_1.SlugWithLinkComponent,
        tableId: 'product-list',
        columnId: 'slug',
    }),
    (0, react_1.registerReactDataTableComponent)({
        component: SlugWithLink_1.SlugWithLink,
        tableId: 'collection-list',
        columnId: 'slug',
        props: {
            foo: 'bar',
        },
    }),
    (0, react_1.registerReactCustomDetailComponent)({
        locationId: 'product-detail',
        component: CustomDetailComponent_1.ProductInfo,
    }),
];
//# sourceMappingURL=providers.js.map