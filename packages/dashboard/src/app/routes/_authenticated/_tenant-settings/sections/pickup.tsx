import { useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';

// 复用现有后端 pickupLocations admin query（纯字符串文档，仅展示列表）
const pickupLocationsDocument = `
    query GetPickupLocations {
        pickupLocations {
            items {
                id
                name
                type
                address
                phoneNumber
                businessHours
                isPublic
                province
                city
                district
                street
            }
            totalItems
        }
    }
`;

export default function PickupSection({ channelId }: { channelId: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['pickupLocations', channelId],
        queryFn: () => api.query(pickupLocationsDocument, {}),
    });

    const items: any[] = (data as any)?.pickupLocations?.items ?? [];

    return (
        <div>
            <h2 className="mb-2 text-lg font-semibold">自提点</h2>
            {isLoading ? (
                <p className="text-muted-foreground">加载中…</p>
            ) : items.length === 0 ? (
                <p className="text-muted-foreground">暂无自提点。</p>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b text-left text-muted-foreground">
                            <th className="py-1 pr-2">名称</th>
                            <th className="py-1 pr-2">类型</th>
                            <th className="py-1 pr-2">地址</th>
                            <th className="py-1 pr-2">电话</th>
                            <th className="py-1 pr-2">营业时间</th>
                            <th className="py-1 pr-2">公开</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((p: any) => (
                            <tr key={p.id} className="border-b">
                                <td className="py-1 pr-2">{p.name}</td>
                                <td className="py-1 pr-2">{p.type}</td>
                                <td className="py-1 pr-2">{p.address}</td>
                                <td className="py-1 pr-2">{p.phoneNumber ?? '—'}</td>
                                <td className="py-1 pr-2">{p.businessHours ?? '—'}</td>
                                <td className="py-1 pr-2">{p.isPublic ? '是' : '否'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}