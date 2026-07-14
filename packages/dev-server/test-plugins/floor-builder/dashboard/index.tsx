import { defineDashboardExtension } from '@vendure/dashboard';

import { FloorBuilderBlock } from './FloorBuilderBlock';

defineDashboardExtension({
    pageBlocks: [
        {
            id: 'floor-builder',
            component: FloorBuilderBlock,
            title: '楼层搭建器',
            location: {
                pageId: 'collection-detail',
                column: 'main',
                position: { blockId: 'contents', order: 'after' },
            },
        },
    ],
});
