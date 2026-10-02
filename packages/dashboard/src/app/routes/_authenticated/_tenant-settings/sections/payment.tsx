import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';
import { Button } from '@/vdb/components/ui/button.js';
import { SettingsForm, Fields } from '../settings-form.js';
import { tenantSettingsDocument, updateTenantConfigDocument } from '../tenant-settings.graphql.js';

const fields: Fields = [
    {
        group: '支付宝',
        fields: [
            { name: 'alipay.appId', label: 'AppId', type: 'text' },
            { name: 'alipay.privateKey', label: '私钥', type: 'password' },
            { name: 'alipay.tradeType', label: '交易类型', type: 'text' },
        ],
    },
    {
        group: '微信支付',
        fields: [
            { name: 'wechatpay.appId', label: 'AppId', type: 'text' },
            { name: 'wechatpay.mchId', label: '商户号', type: 'text' },
            { name: 'wechatpay.apiKey', label: 'API Key', type: 'password' },
            { name: 'wechatpay.serialNo', label: '证书序列号', type: 'text' },
            {
                name: 'wechatpay.notifyUrl',
                label: '回调地址',
                type: 'text',
            },
        ],
    },
    {
        group: '抖音支付',
        fields: [
            { name: 'douyinpay.appId', label: 'AppId', type: 'text' },
            { name: 'douyinpay.appSecret', label: 'AppSecret', type: 'password' },
        ],
    },
];

export default function PaymentSection({ channelId }: { channelId: string }) {
    const { data, refetch } = useQuery({
        queryKey: ['tenantSettings', channelId],
        queryFn: () => api.query(tenantSettingsDocument, { channelId }),
    });
    const [values, setValues] = useState<Record<string, any>>({});

    const pay = (data as any)?.tenantSettings?.pay;
    useEffect(() => {
        if (pay) setValues(pay);
    }, [pay]);

    const mutation = useMutation({
        mutationFn: (patch: Record<string, any>) =>
            api.mutate(updateTenantConfigDocument, { input: { channelId, payPatch: patch } }),
        onSuccess: () => refetch(),
    });

    return (
        <div>
            <SettingsForm fields={fields} values={values} onChange={setValues} />
            <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(values)}>
                保存支付设置
            </Button>
        </div>
    );
}