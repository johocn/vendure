"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dashboard_1 = require("@vendure/dashboard");
const FloorBuilderBlock_1 = require("./FloorBuilderBlock");
(0, dashboard_1.defineDashboardExtension)({
    pageBlocks: [
        {
            id: 'floor-builder',
            component: FloorBuilderBlock_1.FloorBuilderBlock,
            title: '楼层搭建器',
            location: {
                pageId: 'collection-detail',
                column: 'main',
                position: { blockId: 'contents', order: 'after' },
            },
        },
    ],
});
//# sourceMappingURL=index.js.map