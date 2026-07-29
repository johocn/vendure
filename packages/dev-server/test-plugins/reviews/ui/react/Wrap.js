"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wrap = Wrap;
const jsx_runtime_1 = require("react/jsx-runtime");
const core_1 = require("@angular/core");
const platform_browser_1 = require("@angular/platform-browser");
const react_1 = require("@vendure/admin-ui/react");
const react_2 = require("react");
function Wrap(props) {
    const context = (0, react_2.useContext)(react_1.HostedComponentContext);
    const hostRef = (0, react_2.useRef)(null);
    const [appRef, setAppRef] = (0, react_2.useState)(null);
    const [compRef, setCompRef] = (0, react_2.useState)(null);
    (0, react_2.useEffect)(() => {
        void (0, platform_browser_1.createApplication)().then(setAppRef);
        return () => appRef === null || appRef === void 0 ? void 0 : appRef.destroy();
    }, []);
    (0, react_2.useEffect)(() => {
        if (appRef && hostRef.current) {
            setCompRef((0, core_1.createComponent)(props.cmp, {
                environmentInjector: appRef.injector,
                hostElement: hostRef.current,
                projectableNodes: [props.children],
            }));
        }
        return () => compRef === null || compRef === void 0 ? void 0 : compRef.destroy();
    }, [appRef, hostRef, props.cmp]);
    (0, react_2.useEffect)(() => {
        if (compRef) {
            for (const [key, value] of Object.entries(props.inputs || {})) {
                compRef.setInput(key, value);
            }
            compRef.changeDetectorRef.detectChanges();
        }
    }, [compRef, props.inputs]);
    return (0, jsx_runtime_1.jsx)("div", { ref: hostRef });
}
//# sourceMappingURL=Wrap.js.map