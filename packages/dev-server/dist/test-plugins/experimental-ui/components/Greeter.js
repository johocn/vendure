"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Greeter = Greeter;
const jsx_runtime_1 = require("react/jsx-runtime");
const icon_1 = require("@cds/core/icon");
const core_1 = require("@vendure/admin-ui/core");
const react_1 = require("@vendure/admin-ui/react");
const react_2 = require("react");
(0, react_1.registerCdsIcon)(icon_1.userIcon);
function Greeter(props) {
    const { params, queryParams } = (0, react_1.useRouteParams)();
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
    console.log(`Greeter.tsx: params: ${JSON.stringify(params)}, queryParams: ${JSON.stringify(queryParams)}`);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "page-block", children: [(0, jsx_runtime_1.jsxs)(react_1.Card, { title: `Hello ${props.name}`, children: [(0, jsx_runtime_1.jsx)("button", { className: "button primary", onClick: handleClick, children: "Click me" }), (0, jsx_runtime_1.jsx)("cds-icon", { shape: "user", flip: 'vertical', badge: 'warning', solid: true, size: 'xxl' }), (0, jsx_runtime_1.jsxs)("div", { className: "form-grid", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("input", { value: titleValue, onInput: e => setTitleValue(e.target.value) }), (0, jsx_runtime_1.jsx)("button", { className: "button secondary", onClick: () => setTitle(titleValue), children: "Set title" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("input", { value: breadcrumbValue, onInput: e => setBreadcrumbValue(e.target.value) }), (0, jsx_runtime_1.jsx)("button", { className: "button secondary", onClick: () => setBreadcrumb(breadcrumbValue), children: "Set breadcrumb" })] })] })] }), (0, jsx_runtime_1.jsx)(react_1.Card, { title: 'Buttons', children: (0, jsx_runtime_1.jsxs)("div", { className: "flex center", style: { gap: '12px' }, children: [(0, jsx_runtime_1.jsx)("button", { className: "button primary", children: "Primary" }), (0, jsx_runtime_1.jsx)("button", { className: "button secondary", children: "Secondary" }), (0, jsx_runtime_1.jsx)("button", { className: "button success", children: "Success" }), (0, jsx_runtime_1.jsx)("button", { className: "button warning", children: "Warning" }), (0, jsx_runtime_1.jsx)("button", { className: "button danger", children: "Danger" }), (0, jsx_runtime_1.jsx)("button", { className: "button-ghost", children: "Ghost" }), (0, jsx_runtime_1.jsx)("button", { className: "button-small", children: "Small" })] }) }), (0, jsx_runtime_1.jsx)(react_1.Card, { title: 'Testing the card', children: "Yolo" })] }));
}
//# sourceMappingURL=Greeter.js.map