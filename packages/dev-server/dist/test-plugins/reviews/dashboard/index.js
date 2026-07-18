"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const dashboard_1 = require("@vendure/dashboard");
const lucide_react_1 = require("lucide-react");
const sonner_1 = require("sonner");
const custom_form_components_1 = require("./custom-form-components");
const custom_widget_1 = require("./custom-widget");
const review_detail_1 = require("./review-detail");
const review_list_1 = require("./review-list");
const review_select_with_create_1 = require("./review-select-with-create");
const route_without_auth_1 = require("./route-without-auth");
(0, dashboard_1.defineDashboardExtension)({
    login: {
        afterForm: {
            component: () => ((0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)(dashboard_1.Button, { variant: "secondary", className: "w-full", children: "Login with Vendure ID" }) })),
        },
    },
    routes: [review_list_1.reviewList, review_detail_1.reviewDetail, route_without_auth_1.routeWithoutAuth],
    widgets: [
        {
            id: 'custom-widget',
            name: 'Custom Widget',
            component: custom_widget_1.CustomWidget,
            defaultSize: { w: 3, h: 3 },
        },
    ],
    actionBarItems: [
        {
            pageId: 'product-detail',
            component: function TestButton(props) {
                const page = (0, dashboard_1.usePage)();
                return ((0, jsx_runtime_1.jsx)(dashboard_1.Button, { type: "button", onClick: () => {
                        console.log('Clicked custom action bar item', props.context.entity);
                    }, children: "Test Button" }));
            },
            position: {
                itemId: 'save-button',
                order: 'after',
            },
        },
    ],
    pageBlocks: [
        {
            id: 'my-block',
            component: ({ context }) => {
                return (0, jsx_runtime_1.jsx)("div", { children: "Here is my custom block!" });
            },
            title: 'My Custom Block',
            location: {
                pageId: 'product-detail',
                column: 'side',
                position: { blockId: 'main-form', order: 'after' },
            },
        },
    ],
    customFormComponents: {
        customFields: [
            {
                id: 'textarea',
                component: custom_form_components_1.TextareaCustomField,
            },
            {
                id: 'review-single-select',
                component: custom_form_components_1.ReviewSingleSelect,
            },
            {
                id: 'review-multi-select',
                component: custom_form_components_1.ReviewMultiSelect,
            },
            {
                id: 'review-multi-select-with-create',
                component: review_select_with_create_1.ReviewSelectWithCreate,
            },
        ],
    },
    detailForms: [
        {
            pageId: 'product-variant-detail',
            // extendDetailDocument: `
            //     query {
            //         productVariant(id: $id) {
            //             stockOnHand
            //             product {
            //               facetValues {
            //                 id
            //                 name
            //                 facet {
            //                 code
            //                 }
            //               }
            //               customFields {
            //                 featuredReview {
            //                     id
            //                     productVariant {
            //                         id
            //                         name
            //                     }
            //                     product {
            //                     name
            //                     }
            //                 }
            //               }
            //             }
            //         }
            //     }
            // `,
        },
        {
            pageId: 'review-detail',
            inputs: [
                {
                    blockId: 'main-form',
                    field: 'body',
                    component: custom_form_components_1.BodyInputComponent,
                },
                {
                    blockId: 'main-form',
                    field: 'state',
                    component: custom_form_components_1.ReviewStateSelect,
                },
                {
                    blockId: 'main-form',
                    field: 'response',
                    component: custom_form_components_1.ResponseDisplay,
                },
            ],
        },
    ],
    dataTables: [
        {
            pageId: 'product-list',
            bulkActions: [
                {
                    component: props => ((0, jsx_runtime_1.jsx)(dashboard_1.DataTableBulkActionItem, { onClick: () => {
                            console.log('Selection:', props.selection);
                            sonner_1.toast.message(`There are ${props.selection.length} selected items`);
                        }, label: "My Custom Action", icon: lucide_react_1.InfoIcon })),
                },
            ],
            // extendListDocument: `
            //     query {
            //         products {
            //             items {
            //                 customFields {
            //                     featuredReview {
            //                         id
            //                         productVariant {
            //                             id
            //                             name
            //                         }
            //                     }
            //                 }
            //             }
            //         }
            //     }
            // `,
        },
    ],
});
//# sourceMappingURL=index.js.map