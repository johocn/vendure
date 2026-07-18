"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllProductReviewsList = AllProductReviewsList;
const jsx_runtime_1 = require("react/jsx-runtime");
const core_1 = require("@vendure/admin-ui/core");
const react_1 = require("@vendure/admin-ui/react");
const react_2 = require("react");
function AllProductReviewsList(props) {
    const notificationService = (0, react_1.useInjector)(core_1.NotificationService);
    const { setTitle, setBreadcrumb } = (0, react_1.usePageMetadata)();
    const [titleValue, setTitleValue] = (0, react_2.useState)('');
    const [breadcrumbValue, setBreadcrumbValue] = (0, react_2.useState)('Greeter');
    (0, react_2.useEffect)(() => {
        setTitle('My Page');
        setBreadcrumb([
            { link: ['./parent'], label: 'Parent Page' },
            { link: ['./'], label: 'This Page' },
        ]);
    }, []);
    function handleClick() {
        notificationService.success('You clicked me!');
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "page-block", children: [(0, jsx_runtime_1.jsxs)("h2", { children: ["Hello ", props.name] }), (0, jsx_runtime_1.jsx)("button", { className: "button primary", onClick: handleClick, children: "Click me" }), (0, jsx_runtime_1.jsxs)("div", { className: "card", children: [(0, jsx_runtime_1.jsx)("input", { value: titleValue, onInput: e => setTitleValue(e.target.value) }), (0, jsx_runtime_1.jsx)("button", { className: "button secondary", onClick: () => setTitle(titleValue), children: "Set title" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "card", children: [(0, jsx_runtime_1.jsx)("input", { value: breadcrumbValue, onInput: e => setBreadcrumbValue(e.target.value) }), (0, jsx_runtime_1.jsx)("button", { className: "button secondary", onClick: () => setBreadcrumb(breadcrumbValue), children: "Set breadcrumb" })] }), "hello"] }));
}
//# sourceMappingURL=AllProductReviewsList.js.map