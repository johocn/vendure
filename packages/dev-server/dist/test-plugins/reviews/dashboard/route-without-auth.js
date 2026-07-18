"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeWithoutAuth = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const zod_1 = require("zod");
const schema = zod_1.z.object({
    test: zod_1.z.string(),
    test2: zod_1.z.string().optional(),
});
exports.routeWithoutAuth = {
    component: route => {
        const search = route.useSearch();
        return (0, jsx_runtime_1.jsxs)("div", { children: ["Hello from without auth! Test Param from search params: ", search.test] });
    },
    validateSearch: search => schema.parse(search),
    path: '/without-auth',
    authenticated: false,
};
//# sourceMappingURL=route-without-auth.js.map