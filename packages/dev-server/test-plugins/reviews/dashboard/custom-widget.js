"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomWidget = CustomWidget;
const jsx_runtime_1 = require("react/jsx-runtime");
const dashboard_1 = require("@vendure/dashboard");
function CustomWidget() {
    return ((0, jsx_runtime_1.jsx)(dashboard_1.DashboardBaseWidget, { id: "custom-widget", title: "Custom Widget", description: "This is a custom widget", children: (0, jsx_runtime_1.jsx)("div", { children: "Hello from the reviews plugin" }) }));
}
//# sourceMappingURL=custom-widget.js.map