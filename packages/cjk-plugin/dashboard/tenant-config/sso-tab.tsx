import { useState } from 'react';
import { SectionCard } from './shared/section-card';
import { MaskedInput } from './shared/masked-input';

interface Props {
    data: any;
    canEdit: boolean;
    onSave: (patch: any) => Promise<any>;
    onTest: (providerKey: string, newClientSecret?: string) => Promise<any>;
}

export function SsoTab({ data, canEdit, onSave, onTest }: Props) {
    const providers: any[] = data?.ssoProviders || [];
    const [testing, setTesting] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<any>(null);

    const handleTest = async (providerKey: string) => {
        setTesting(providerKey);
        setTestResult(null);
        const result = await onTest(providerKey);
        setTestResult(result?.data?.testSsoConnection);
        setTesting(null);
    };

    const handleFieldSave = (index: number, field: string, value: string) => {
        const newProviders = [...providers];
        newProviders[index] = { ...newProviders[index], [field]: value };
        onSave({ authPatch: { ssoProviders: newProviders } });
    };

    return (
        <div>
            <div style={{ background: '#fff3cd', padding: 8, marginBottom: 16 }}>
                提示: Strapi 侧 sso-app 需在 zhao-sso 插件管理面板同步配置 app_code/app_secret/redirect_uris
            </div>
            {providers.map((p, i) => (
                <SectionCard key={p.providerKey} title={`SSO Provider: ${p.name}`}>
                    <MaskedInput label="name" value={p.name} disabled={!canEdit} onCommit={v => handleFieldSave(i, 'name', v)} />
                    <MaskedInput label="providerKey" value={p.providerKey} disabled={!canEdit} onCommit={v => handleFieldSave(i, 'providerKey', v)} />
                    <div>
                        <label>protocol</label>
                        <select value={p.protocol} disabled={!canEdit} onChange={e => handleFieldSave(i, 'protocol', e.target.value)}>
                            <option value="zhao-sso">zhao-sso</option>
                            <option value="oauth2">oauth2</option>
                        </select>
                    </div>
                    <MaskedInput label="baseUrl" value={p.baseUrl} disabled={!canEdit} onCommit={v => handleFieldSave(i, 'baseUrl', v)} />
                    <MaskedInput label="clientId(app_code)" value={p.clientId} disabled={!canEdit} onCommit={v => handleFieldSave(i, 'clientId', v)} />
                    <MaskedInput label="clientSecret(app_secret)" value={p.clientSecret} disabled={!canEdit} onCommit={v => handleFieldSave(i, 'clientSecret', v)} />
                    <MaskedInput label="channelCode" value={p.channelCode} disabled={!canEdit} onCommit={v => handleFieldSave(i, 'channelCode', v)} />
                    <button onClick={() => handleTest(p.providerKey)} disabled={!canEdit || testing === p.providerKey}>
                        {testing === p.providerKey ? '测试中...' : '测试连通性'}
                    </button>
                    {testResult && (
                        <div style={{ marginTop: 8 }}>
                            结果: {testResult.success ? '✅ 成功' : '❌ 失败'} ({testResult.latencyMs}ms)
                            {testResult.error && <div>错误: {testResult.error}</div>}
                        </div>
                    )}
                </SectionCard>
            ))}
        </div>
    );
}
