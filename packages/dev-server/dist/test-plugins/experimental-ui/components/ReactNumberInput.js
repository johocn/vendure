"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNumberInput = ReactNumberInput;
const jsx_runtime_1 = require("react/jsx-runtime");
const core_1 = require("@vendure/admin-ui/core");
const react_1 = require("@vendure/admin-ui/react");
function ReactNumberInput({ readonly }) {
    const { value, setFormValue } = (0, react_1.useFormControl)();
    const notificationService = (0, react_1.useInjector)(core_1.NotificationService);
    const handleChange = (e) => {
        const val = +e.target.value;
        if (val === 0) {
            notificationService.error('Cannot be zero');
        }
        else {
            setFormValue(val);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: ["This is a React component!", (0, jsx_runtime_1.jsx)("input", { readOnly: readonly, type: "number", onChange: handleChange, value: value })] }));
}
//# sourceMappingURL=ReactNumberInput.js.map