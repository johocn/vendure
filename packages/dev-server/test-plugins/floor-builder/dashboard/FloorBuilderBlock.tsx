import { usePage } from '@vendure/dashboard';
import { useMemo } from 'react';

interface FloorItemConfig {
    productId: string;
    size: string;
    highlighted: boolean;
    label: string;
}

export function FloorBuilderBlock() {
    const page = usePage();
    const entity = page?.entity as any;

    // 读取当前 Collection 的 customFields
    const floorItemConfig: FloorItemConfig[] = entity?.customFields?.floorItemConfig || [];
    const productVariants = entity?.productVariants?.items || [];

    // 预览：根据 floorLayout 渲染不同布局
    const floorLayout = entity?.customFields?.floorLayout || 'double_grid';
    const floorTitle = entity?.customFields?.floorTitle || entity?.name || '';

    if (!entity) {
        return <div className="p-4 text-gray-500">请先保存 Collection</div>;
    }

    return (
        <div className="space-y-4 p-4">
            <h3 className="text-lg font-semibold">楼层搭建器</h3>
            <div className="rounded border p-4 bg-gray-50">
                <h4 className="text-sm font-medium mb-2">实时预览（{floorLayout}）</h4>
                <div className="bg-white rounded p-2" style={{ maxWidth: '375px', margin: '0 auto' }}>
                    <div className="font-bold text-sm mb-2">{floorTitle}</div>
                    <PreviewGrid
                        layout={floorLayout}
                        items={productVariants.slice(0, 6)}
                        itemConfig={floorItemConfig}
                    />
                </div>
            </div>
            <div className="text-sm text-gray-600">
                <p>商品选品：在上方 "Contents" 区域使用 product-id-filter 添加商品</p>
                <p>外观配置：在下方 "Custom fields" 区域配置 floorLayout、floorTheme、floorItemConfig</p>
                <p>floorItemConfig 中的 productId 必须与 Contents 中的商品 ID 一致</p>
            </div>
        </div>
    );
}

function PreviewGrid({ layout, items, itemConfig }: {
    layout: string;
    items: any[];
    itemConfig: FloorItemConfig[];
}) {
    const cols = layout === 'triple_grid' ? 3 : layout === 'double_grid' ? 2 : layout === 'single_scroll' ? 1 : 2;

    if (layout === 'hero_with_list' && items.length > 0) {
        return (
            <div>
                <div className="bg-gray-200 h-32 rounded mb-2 flex items-center justify-center">
                    <img src={items[0]?.product?.featuredAsset?.preview} alt="" className="max-h-full" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {items.slice(1, 5).map(v => <PreviewItem key={v.id} name={v.product?.name} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {items.map(v => <PreviewItem key={v.id} name={v.product?.name} />)}
        </div>
    );
}

function PreviewItem({ name }: { name?: string }) {
    return (
        <div className="bg-gray-100 rounded p-2 text-center">
            <div className="bg-gray-200 h-16 rounded mb-1" />
            <div className="text-xs truncate">{name || '商品名'}</div>
        </div>
    );
}
