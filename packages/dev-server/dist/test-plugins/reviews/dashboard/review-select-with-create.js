"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewSelectWithCreate = ReviewSelectWithCreate;
const jsx_runtime_1 = require("react/jsx-runtime");
const button_1 = require("@/vdb/components/ui/button");
const dialog_1 = require("@/vdb/components/ui/dialog");
const field_1 = require("@/vdb/components/ui/field");
const form_1 = require("@/vdb/components/ui/form");
const input_1 = require("@/vdb/components/ui/input");
const textarea_1 = require("@/vdb/components/ui/textarea");
const utils_1 = require("@/vdb/framework/form-engine/utils");
const zod_1 = require("@hookform/resolvers/zod");
const react_hook_form_1 = require("react-hook-form");
const zod_2 = require("zod");
const custom_form_components_1 = require("./custom-form-components");
const formSchema = zod_2.z.object({
    title: zod_2.z.string().min(1, 'Title is required'),
    body: zod_2.z.string().min(1, 'Body is required'),
});
function ReviewSelectWithCreate(props) {
    const form = (0, react_hook_form_1.useForm)({
        resolver: (0, zod_1.zodResolver)(formSchema),
        defaultValues: {
            title: '',
            body: '',
        },
    });
    const onSubmit = (data) => {
        // TODO: Handle form submission
        form.reset();
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(custom_form_components_1.ReviewMultiSelect, Object.assign({}, props)), (0, jsx_runtime_1.jsxs)(dialog_1.Dialog, { children: [(0, jsx_runtime_1.jsx)(dialog_1.DialogTrigger, { render: (0, jsx_runtime_1.jsx)(button_1.Button, { variant: "outline" }), children: "Create new" }), (0, jsx_runtime_1.jsxs)(dialog_1.DialogContent, { children: [(0, jsx_runtime_1.jsx)(dialog_1.DialogHeader, { children: (0, jsx_runtime_1.jsx)(dialog_1.DialogTitle, { children: "Create new review" }) }), (0, jsx_runtime_1.jsx)(form_1.Form, Object.assign({}, form, { children: (0, jsx_runtime_1.jsxs)("form", { onSubmit: (0, utils_1.handleNestedFormSubmit)(form, onSubmit), className: "space-y-4", children: [(0, jsx_runtime_1.jsx)(react_hook_form_1.Controller, { control: form.control, name: "title", render: ({ field, fieldState }) => ((0, jsx_runtime_1.jsxs)(field_1.Field, { "data-invalid": fieldState.invalid || undefined, children: [(0, jsx_runtime_1.jsx)(field_1.FieldLabel, { children: "Title" }), (0, jsx_runtime_1.jsx)(input_1.Input, Object.assign({ placeholder: "Enter review title" }, field)), fieldState.invalid && (0, jsx_runtime_1.jsx)(field_1.FieldError, { errors: [fieldState.error] })] })) }), (0, jsx_runtime_1.jsx)(react_hook_form_1.Controller, { control: form.control, name: "body", render: ({ field, fieldState }) => ((0, jsx_runtime_1.jsxs)(field_1.Field, { "data-invalid": fieldState.invalid || undefined, children: [(0, jsx_runtime_1.jsx)(field_1.FieldLabel, { children: "Body" }), (0, jsx_runtime_1.jsx)(textarea_1.Textarea, Object.assign({ placeholder: "Enter review body", className: "min-h-[100px]" }, field)), fieldState.invalid && (0, jsx_runtime_1.jsx)(field_1.FieldError, { errors: [fieldState.error] })] })) }), (0, jsx_runtime_1.jsx)("div", { className: "flex justify-end gap-2", children: (0, jsx_runtime_1.jsx)(button_1.Button, { type: "submit", children: "Create Review" }) })] }) }))] })] })] }));
}
//# sourceMappingURL=review-select-with-create.js.map