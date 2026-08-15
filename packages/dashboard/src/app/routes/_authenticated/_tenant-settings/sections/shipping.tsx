import { useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';

// 复用现有后端 shippingTemplates / shippingProfiles admin query（纯字符串文档，仅展示列表）
const shippingTemplatesDocument = `
    query GetShippingTemplates {
        shippingTemplates {
            items {
                id
                name
                description
                code
                fulfillmentHandler
                isGlobal
            }
            totalItems
        }
    }
`;

const shippingProfilesDocument = `
    query GetShippingProfiles {
        shippingProfiles {
            items {
                id
                name
                description
                code
                isGlobal
                freeShippingThreshold
            }
            totalItems
        }
    }
`;

export default function ShippingSection({ channelId }: { channelId: string }) {
    const templates = useQuery({
        queryKey: ['shippingTemplates', channelId],
        queryFn: () => api.query(shippingTemplatesDocument, {}),
    });
    const profiles = useQuery({
        queryKey: ['shippingProfiles', channelId],
        queryFn: () => api.query(shippingProfilesDocument, {}),
    });

    const templateItems: any[] = (templates.data as any)?.shippingTemplates?.items ?? [];
    const profileItems: any[] = (profiles.data as any)?.shippingProfiles?.items ?? [];

    return (
        <div className="space-y-6">
            <section>
                <h2 className="mb-2 text-lg font-semibold">配送模板（ShippingTemplate）</h2>
                {templates.isLoading ? (
                    <p className="text-muted-foreground">加载中…</p>
                ) : templateItems.length === 0 ? (
                    <p className="text-muted-foreground">暂无配送模板。</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-muted-foreground">
                                <th className="py-1 pr-2">名称</th>
                                <th className="py-1 pr-2">Code</th>
                                <th className="py-1 pr-2">履约方式</th>
                                <th className="py-1 pr-2">全局</th>
                            </tr>
                        </thead>
                        <tbody>
                            {templateItems.map((t: any) => (
                                <tr key={t.id} className="border-b">
                                    <td className="py-1 pr-2">{t.name}</td>
                                    <td className="py-1 pr-2">{t.code}</td>
                                    <td className="py-1 pr-2">{t.fulfillmentHandler}</td>
                                    <td className="py-1 pr-2">{t.isGlobal ? '是' : '否'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            <section>
                <h2 className="mb-2 text-lg font-semibold">配送方案（ShippingProfile）</h2>
                {profiles.isLoading ? (
                    <p className="text-muted-foreground">加载中…</p>
                ) : profileItems.length === 0 ? (
                    <p className="text-muted-foreground">暂无配送方案。</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left text-muted-foreground">
                                <th className="py-1 pr-2">名称</th>
                                <th className="py-1 pr-2">Code</th>
                                <th className="py-1 pr-2">全局</th>
                                <th className="py-1 pr-2">包邮阈值</th>
                            </tr>
                        </thead>
                        <tbody>
                            {profileItems.map((p: any) => (
                                <tr key={p.id} className="border-b">
                                    <td className="py-1 pr-2">{p.name}</td>
                                    <td className="py-1 pr-2">{p.code}</td>
                                    <td className="py-1 pr-2">{p.isGlobal ? '是' : '否'}</td>
                                    <td className="py-1 pr-2">{p.freeShippingThreshold ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}