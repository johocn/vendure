"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const dashboard_1 = require("@vendure/dashboard");
const lucide_react_1 = require("lucide-react");
const react_1 = require("react");
/**
 * Search trigger — positioned before alerts, demonstrates a common use case.
 */
function SearchTrigger() {
    return ((0, jsx_runtime_1.jsx)(dashboard_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(dashboard_1.Tooltip, { children: [(0, jsx_runtime_1.jsx)(dashboard_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(dashboard_1.Button, { variant: "ghost", size: "icon", onClick: () => alert('Search triggered! In a real plugin, this would open a command palette.'), children: (0, jsx_runtime_1.jsx)(lucide_react_1.SearchIcon, { className: "h-4 w-4" }) }) }), (0, jsx_runtime_1.jsx)(dashboard_1.TooltipContent, { children: "Search (\u2318K)" })] }) }));
}
/**
 * Environment badge — no position specified (goes before all built-in items).
 * Shows a coloured badge indicating the current environment.
 */
function EnvironmentBadge() {
    return ((0, jsx_runtime_1.jsxs)(dashboard_1.Badge, { variant: "outline", className: "text-orange-600 border-orange-400 gap-1", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CloudIcon, { className: "h-3 w-3" }), "Staging"] }));
}
/**
 * Notification bell with count — replaces the built-in alerts icon.
 * Demonstrates the 'replace' positioning.
 */
function CustomNotifications() {
    const [count, setCount] = (0, react_1.useState)(3);
    return ((0, jsx_runtime_1.jsxs)(dashboard_1.DropdownMenu, { children: [(0, jsx_runtime_1.jsx)(dashboard_1.DropdownMenuTrigger, { asChild: true, children: (0, jsx_runtime_1.jsxs)(dashboard_1.Button, { variant: "ghost", size: "icon", className: "relative", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.BellRingIcon, { className: "h-4 w-4" }), count > 0 && ((0, jsx_runtime_1.jsx)("span", { className: "absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center", children: count }))] }) }), (0, jsx_runtime_1.jsxs)(dashboard_1.DropdownMenuContent, { align: "end", className: "w-64", children: [(0, jsx_runtime_1.jsxs)(dashboard_1.DropdownMenuLabel, { children: ["Notifications (", count, ")"] }), (0, jsx_runtime_1.jsx)(dashboard_1.DropdownMenuSeparator, {}), (0, jsx_runtime_1.jsxs)(dashboard_1.DropdownMenuItem, { onClick: () => setCount(c => Math.max(0, c - 1)), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RocketIcon, { className: "h-4 w-4 mr-2" }), "New deployment ready"] }), (0, jsx_runtime_1.jsxs)(dashboard_1.DropdownMenuItem, { onClick: () => setCount(c => Math.max(0, c - 1)), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.MessageSquareIcon, { className: "h-4 w-4 mr-2" }), "2 new reviews pending"] }), (0, jsx_runtime_1.jsxs)(dashboard_1.DropdownMenuItem, { onClick: () => setCount(c => Math.max(0, c - 1)), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ZapIcon, { className: "h-4 w-4 mr-2" }), "Sync completed"] })] })] }));
}
/**
 * Quick-action button — positioned after the dev mode indicator.
 */
function QuickAction() {
    return ((0, jsx_runtime_1.jsx)(dashboard_1.TooltipProvider, { children: (0, jsx_runtime_1.jsxs)(dashboard_1.Tooltip, { children: [(0, jsx_runtime_1.jsx)(dashboard_1.TooltipTrigger, { asChild: true, children: (0, jsx_runtime_1.jsx)(dashboard_1.Button, { variant: "ghost", size: "icon", onClick: () => alert('Quick action!'), children: (0, jsx_runtime_1.jsx)(lucide_react_1.ZapIcon, { className: "h-4 w-4" }) }) }), (0, jsx_runtime_1.jsx)(dashboard_1.TooltipContent, { children: "Quick action" })] }) }));
}
(0, dashboard_1.defineDashboardExtension)({
    toolbarItems: [
        {
            id: 'env-badge',
            component: EnvironmentBadge,
            // No position — goes before all built-in items
        },
        {
            id: 'search-trigger',
            component: SearchTrigger,
            position: { itemId: 'alerts', order: 'before' },
        },
        {
            id: 'quick-action',
            component: QuickAction,
            position: { itemId: 'dev-mode-indicator', order: 'after' },
        },
        {
            id: 'custom-notifications',
            component: CustomNotifications,
            position: { itemId: 'alerts', order: 'replace' },
        },
    ],
});
//# sourceMappingURL=index.js.map