"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const dashboard_1 = require("@vendure/dashboard");
const form_components_1 = require("./form-components");
(0, dashboard_1.defineDashboardExtension)({
    customFormComponents: {
        customFields: [
            {
                id: 'test-input',
                component: props => {
                    return ((0, jsx_runtime_1.jsx)("input", { placeholder: "custom input", value: props.value || '', onChange: e => props.onChange(e.target.value), className: "border rounded-full" }));
                },
            },
            {
                id: 'color-picker',
                component: form_components_1.ColorPickerComponent,
            },
            {
                id: 'custom-email',
                component: form_components_1.EmailInputComponent,
            },
            {
                id: 'multi-currency-input',
                component: form_components_1.MultiCurrencyInputComponent,
            },
            {
                id: 'tags-input',
                component: form_components_1.TagsInputComponent,
            },
        ],
    },
    detailForms: [
        {
            pageId: 'product-detail',
            inputs: [
                {
                    blockId: 'main-form',
                    field: 'slug',
                    component: form_components_1.SlugInputComponent,
                },
                {
                    blockId: 'main-form',
                    field: 'description',
                    component: form_components_1.MarkdownEditorComponent,
                },
            ],
        },
        {
            pageId: 'customer-detail',
            inputs: [
                {
                    blockId: 'main-form',
                    field: 'emailAddress',
                    component: form_components_1.EmailInputComponent,
                },
            ],
        },
    ],
});
//# sourceMappingURL=index.js.map