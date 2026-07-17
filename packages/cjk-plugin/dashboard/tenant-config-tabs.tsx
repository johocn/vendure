import { useState } from 'react';
import { useTenantConfig } from './tenant-config/shared/use-tenant-config';
import { PaymentTab } from './tenant-config/payment-tab';
import { WechatAuthTab } from './tenant-config/wechat-auth-tab';
import { SsoTab } from './tenant-config/sso-tab';
import { MapTab } from './tenant-config/map-tab';

type TabKey = 'payment' | 'wechat-auth' | 'sso' | 'map';

export function TenantConfigTabs({ channelId }: { channelId: string }) {
    const [tab, setTab] = useState<TabKey>('payment');
    const { data, loading, error, update, refetch, testSso } = useTenantConfig(channelId);
    if (loading) return <div>加载中...</div>;
    if (error) return <div>错误: {error.message}</div>;
    if (!data) return null;
    return (
        <div style={{ marginTop: 24 }}>
            <h2>租户配置中心</h2>
            {!data.canEdit && <div style={{ color: 'orange' }}>无权编辑此租户配置</div>}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #ccc', marginBottom: 16 }}>
                {([
                    ['payment', '支付'],
                    ['wechat-auth', '微信登录'],
                    ['sso', 'SSO'],
                    ['map', '地图'],
                ] as [TabKey, string][]).map(([k, label]) => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        style={{ padding: '8px 16px', fontWeight: tab === k ? 'bold' : 'normal', borderBottom: tab === k ? '2px solid #1976d2' : 'none' }}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {tab === 'payment' && <PaymentTab data={data.pay} canEdit={data.canEdit} onSave={update} />}
            {tab === 'wechat-auth' && <WechatAuthTab data={data.auth} canEdit={data.canEdit} onSave={update} />}
            {tab === 'sso' && <SsoTab data={data.auth} canEdit={data.canEdit} onSave={update} onTest={testSso} />}
            {tab === 'map' && <MapTab data={data.map} canEdit={data.canEdit} onSave={update} />}
        </div>
    );
}
