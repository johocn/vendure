"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductInfo = ProductInfo;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("@vendure/admin-ui/react");
const react_2 = require("react");
const cms_data_service_1 = require("../providers/cms-data.service");
function ProductInfo() {
    // The "entity" will vary depending on which detail page this component
    // is embedded in. In this case, it will be a "product" entity.
    const { entity, detailForm } = (0, react_1.useDetailComponentData)();
    const cmsDataService = (0, react_1.useInjector)(cms_data_service_1.CmsDataService);
    const [extraInfo, setExtraInfo] = (0, react_2.useState)();
    (0, react_2.useEffect)(() => {
        if (!(entity === null || entity === void 0 ? void 0 : entity.id)) {
            return;
        }
        const subscription = cmsDataService.getDataFor(entity.id).subscribe(data => {
            setExtraInfo(data);
        });
        return () => subscription.unsubscribe();
    }, [entity === null || entity === void 0 ? void 0 : entity.id]);
    return ((0, jsx_runtime_1.jsx)("div", { className: "mb-4", children: (0, jsx_runtime_1.jsx)(react_1.Card, { title: "CMS Info", children: (0, jsx_runtime_1.jsx)("pre", { children: JSON.stringify(extraInfo, null, 2) }) }) }));
}
//# sourceMappingURL=CustomDetailComponent.js.map