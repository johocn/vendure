"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@vendure/admin-ui/core");
exports.default = [
    (0, core_1.addNavMenuSection)({
        id: 'ui-extensions-library',
        label: 'UI Extensions Library',
        items: [
            {
                id: 'react-ui',
                label: 'React UI',
                routerLink: ['/extensions/ui-library/react-ui'],
            },
            {
                id: 'angular-ui',
                label: 'Angular UI',
                routerLink: ['/extensions/ui-library/angular-ui'],
            },
        ],
    }),
];
//# sourceMappingURL=providers.js.map