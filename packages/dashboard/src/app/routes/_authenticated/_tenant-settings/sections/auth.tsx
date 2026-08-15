import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';
import { Button } from '@/vdb/components/ui/button.js';
import { Input } from '@/vdb/components/ui/input.js';
import { Label } from '@/vdb/components/ui/label.js';
import { SettingsForm, Fields, deepGet } from '../settings-form.js';
import { tenantSettingsDocument, updateTenantConfigDocument } from '../tenant-settings.graphql.js';

const fields: Fields = [
    { name: 'enabledMethods', label: '启用登录方式（每行一项：native/phone/wechat/alipay/douyin/sso）', type: 'stringList' },
    {
        group: '手机短信',
        fields: [
            { name: 'overrides.phone.accessKeyId', label: 'AccessKeyId', type: 'text' },
            { name: 'overrides.phone.accessKeySecret', label: 'AccessKeySecret', type: 'password' },
            { name: 'overrides.phone.signName', label: '签名', type: 'text' },
            { name: 'overrides.phone.templateCode', label: '模板Code', type: 'text' },
        ],
    },
    {
        group: '微信',
        fields: [
            { name: 'overrides.wechat.appId', label: 'AppId', type: 'text' },
            { name: 'overrides.wechat.appSecret', label: 'AppSecret', type: 'password' },
        ],
    },
];

// SSO 提供方一行包含的字段；(clientSecret 传 *** 时后端按 providerKey 保留原值)
const ssoRowFields = [
    { key: 'providerKey', label: 'ProviderKey（唯一标识，必填）', type: 'text' },
    { key: 'name', label: 'SSO 名称', type: 'text' },
    { key: 'baseUrl', label: 'BaseUrl', type: 'text' },
    { key: 'clientId', label: 'ClientId', type: 'text' },
    { key: 'clientSecret', label: 'ClientSecret', type: 'password' },
];

export default function AuthSection({ channelId }: { channelId: string }) {
    const { data, refetch } = useQuery({
        queryKey: ['tenantSettings', channelId],
        queryFn: () => api.query(tenantSettingsDocument, { channelId }),
    });
    const [values, setValues] = useState<Record<string, any>>({});

    const auth = (data as any)?.tenantSettings?.auth;
    useEffect(() => {
        if (auth) setValues(auth);
    }, [auth]);

    // SSO 数组行级编辑
    const providers: any[] = Array.isArray(values.ssoProviders) ? values.ssoProviders : [];
    const setProviderField = (index: number, key: string, v: string) => {
        const next = providers.map((p, i) => (i === index ? { ...p, [key]: v } : p));
        setValues({ ...values, ssoProviders: next });
    };
    const removeProvider = (index: number) => {
        setValues({ ...values, ssoProviders: providers.filter((_, i) => i !== index) });
    };
    const addProvider = () => {
        const providerKey = `provider_${Date.now()}`;
        setValues({ ...values, ssoProviders: [...providers, { providerKey, name: '', baseUrl: '', clientId: '', clientSecret: '' }] });
    };

    const mutation = useMutation({
        mutationFn: (patch: Record<string, any>) =>
            api.mutate(updateTenantConfigDocument, { input: { channelId, authPatch: patch } }),
        onSuccess: () => refetch(),
    });

    return (
        <div>
            <SettingsForm fields={fields} values={values} onChange={setValues} />
            <fieldset className="mb-4">
                <legend className="font-semibold">SSO 提供方</legend>
                {providers.length === 0 && <p className="text-sm text-muted-foreground">暂无 SSO 提供方。</p>}
                {providers.map((p, idx) => {
                    const key = p?.providerKey || idx;
                    return (
                        <div key={key} className="mb-3 rounded border p-3">
                            <div className="grid gap-2 md:grid-cols-2">
                                {ssoRowFields.map((f) => (
                                    <div key={f.key} className="grid gap-1">
                                        <Label>{f.label}</Label>
                                        <Input
                                            type={f.type}
                                            value={deepGet(p, f.key) ?? ''}
                                            onChange={(e) => setProviderField(idx, f.key, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="mt-2"
                                onClick={() => removeProvider(idx)}
                            >
                                删除该行
                            </Button>
                        </div>
                    );
                })}
                <Button type="button" variant="outline" onClick={addProvider}>
                    新增 SSO 提供方
                </Button>
            </fieldset>
            <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(values)}>
                保存登录认证设置
            </Button>
        </div>
    );
}