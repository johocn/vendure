"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/admin-ui/core");
const react_1 = require("@vendure/admin-ui/react");
const angular_ui_component_1 = require("./angular-components/angular-ui/angular-ui.component");
const ReactUi_1 = require("./react-components/ReactUi");
exports.default = [
    (0, react_1.registerReactRouteComponent)({
        path: 'react-ui',
        component: ReactUi_1.ReactUi,
        title: 'React UI',
        description: "Test description",
        locationId: "react-ui"
    }),
    (0, core_1.registerRouteComponent)({
        path: 'angular-ui',
        component: angular_ui_component_1.AngularUiComponent,
        title: 'Angular UI',
        locationId: "angular-ui",
        description: "Test description 2",
        routeConfig: {
            canDeactivate: [core_1.CanDeactivateDetailGuard],
        },
    }),
];
//# sourceMappingURL=routes.js.map