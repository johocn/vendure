"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dashboard_1 = require("@vendure/dashboard");
const lucide_react_1 = require("lucide-react");
/**
 * Demonstrates the function form of `navSections`.
 *
 * This moves the "Administrators" and "Roles" nav items from the
 * "Settings" section into a new "Access & Identity" section.
 */
(0, dashboard_1.defineDashboardExtension)({
    navSections: (config) => {
        var _a;
        const idsToMove = ['administrators', 'roles'];
        // Find the settings section and extract the items we want to move
        const settings = config.sections.find(s => s.id === 'settings');
        const settingsItems = settings && 'items' in settings ? (_a = settings.items) !== null && _a !== void 0 ? _a : [] : [];
        const movedItems = settingsItems.filter(i => idsToMove.includes(i.id));
        return {
            sections: [
                // Keep all existing sections, but remove the moved items from Settings
                ...config.sections.map(section => {
                    var _a;
                    return section.id === 'settings' && 'items' in section
                        ? Object.assign(Object.assign({}, section), { items: (_a = section.items) === null || _a === void 0 ? void 0 : _a.filter(i => !idsToMove.includes(i.id)) }) : section;
                }),
                // Add the new section with the relocated items
                {
                    id: 'access-and-identity',
                    title: 'Access & Identity',
                    icon: lucide_react_1.ShieldCheck,
                    order: 150,
                    placement: 'bottom',
                    items: [...movedItems],
                },
            ],
        };
    },
});
//# sourceMappingURL=index.js.map