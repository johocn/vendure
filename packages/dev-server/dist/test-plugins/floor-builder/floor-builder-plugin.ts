import { EventBus, PluginCommonModule, ProductEvent, VendurePlugin } from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';

@VendurePlugin({
    imports: [PluginCommonModule],
    dashboard: './dashboard/index.tsx',
})
export class FloorBuilderPlugin implements OnApplicationBootstrap {
    constructor(private readonly eventBus: EventBus) {}

    onApplicationBootstrap(): void {
        // 商品删除时，清理 floorItemConfig 中的悬挂 productId 引用
        this.eventBus.ofType(ProductEvent).subscribe(async event => {
            if (event.type !== 'deleted') return;
            // struct list 的悬挂引用在前端查询时跳过即可，无需后端清理
            // 此处仅记录日志，便于排查
            console.log(`[FloorBuilderPlugin] Product deleted: ${event.entity.id}, floorItemConfig references may be orphaned`);
        });
    }
}
