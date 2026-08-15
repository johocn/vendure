import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';
import { Button } from '@/vdb/components/ui/button.js';
import { SettingsForm, Fields } from '../settings-form.js';
import { tenantSettingsDocument, updateTenantServiceNotifyDocument } from '../tenant-settings.graphql.js';

const fields: Fields = [
    { name: 'wecomEnabled', label: '启用企业微信客服/通知', type: 'boolean' },
    { name: 'wecomAgentId', label: '企微 AgentId', type: 'text' },
    { name: 'wecomCorpId', label: '企微 CorpId', type: 'text' },
    { name: 'wecomCorpSecret', label: '企微 CorpSecret', type: 'password' },
    { name: 'wechatPushEnabled', label: '启用微信消息推送', type: 'boolean' },
    {
        group: '微信推送模板',
        fields: [
            { name: 'wechatPushTemplate.orderCreated', label: '下单模板', type: 'text' },
            { name: 'wechatPushTemplate.orderShipped', label: '发货模板', type: 'text' },
            { name: 'wechatPushTemplate.orderAfterSale', label: '售后模板', type: 'text' },
        ],
    },
    { name: 'chatChannelEnabled', label: '启用在线客服入口（占位）', type: 'boolean' },
];

export default function ServiceNotifySection({ channelId }: { channelId: string }) {
    const { data, refetch } = useQuery({
        queryKey: ['tenantSettings', channelId],
        queryFn: () => api.query(tenantSettingsDocument, { channelId }),
    });
    const [values, setValues] = useState<Record<string, any>>({});

    const serviceNotify = (data as any)?.tenantSettings?.serviceNotify;
    useEffect(() => {
        if (serviceNotify) setValues(serviceNotify);
    }, [serviceNotify]);

    const mutation = useMutation({
        mutationFn: (patch: Record<string, any>) =>
            api.mutate(updateTenantServiceNotifyDocument, { input: { channelId, patch } }),
        onSuccess: () => refetch(),
    });

    return (
        <div>
            <SettingsForm fields={fields} values={values} onChange={setValues} />
            <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(values)}>
                保存客服与通知设置
            </Button>
        </div>
    );
}