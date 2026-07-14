import { defineDashboardExtension } from '@vendure/dashboard';

defineDashboardExtension({
    pageBlocks: [
        {
            id: 'floor-builder',
            component: () => null,
            title: '楼层搭建器',
            location: {
                pageId: 'collection-detail',
                column: 'main',
                position: { blockId: 'contents', order: 'after' },
            },
        },
    ],
});
