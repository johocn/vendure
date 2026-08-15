import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';
import { Button } from '@/vdb/components/ui/button.js';
import { SettingsForm, Fields } from '../settings-form.js';
import { tenantSettingsDocument, updateTenantBasicDocument } from '../tenant-settings.graphql.js';

const fields: Fields = [
    { name: 'tenantName', label: '租户名称', type: 'text' },
    { name: 'contactPhone', label: '联系电话', type: 'text' },
    { name: 'address', label: '地址', type: 'textarea' },
    { name: 'timeZoneId', label: '时区', type: 'text' },
    {
        group: '单据抬头',
        fields: [
            { name: 'invoiceHeader.companyName', label: '公司名称', type: 'text' },
            { name: 'invoiceHeader.taxNo', label: '税号', type: 'text' },
            { name: 'invoiceHeader.invoiceAddress', label: '发票地址', type: 'text' },
            { name: 'invoiceHeader.invoicePhone', label: '发票电话', type: 'text' },
            { name: 'invoiceHeader.bankInfo', label: '开户行及账号', type: 'text' },
        ],
    },
    {
        group: '客服联系方式',
        fields: [
            { name: 'serviceContacts.phones', label: '客服电话（每行一项）', type: 'stringList' },
            { name: 'serviceContacts.emails', label: '客服邮箱（每行一项）', type: 'stringList' },
            { name: 'serviceContacts.wechats', label: '客服微信（每行一项）', type: 'stringList' },
            { name: 'serviceContacts.wecomId', label: '企业微信', type: 'text' },
            { name: 'serviceContacts.onlineChatEnabled', label: '启用在线客服', type: 'boolean' },
        ],
    },
];

export default function BasicSection({ channelId }: { channelId: string }) {
    const { data, refetch } = useQuery({
        queryKey: ['tenantSettings', channelId],
        queryFn: () => api.query(tenantSettingsDocument, { channelId }),
    });
    const [values, setValues] = useState<Record<string, any>>({});

    // data 就绪时用服务端 basic 段初始化本地 state（仅首次）
    const basic = (data as any)?.tenantSettings?.basic;
    useEffect(() => {
        if (basic) setValues(basic);
    }, [basic]);

    const mutation = useMutation({
        mutationFn: (patch: Record<string, any>) =>
            api.mutate(updateTenantBasicDocument, { input: { channelId, patch } }),
        onSuccess: () => refetch(),
    });

    return (
        <div>
            <SettingsForm fields={fields} values={values} onChange={setValues} />
            <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(values)}>
                保存基本设置
            </Button>
        </div>
    );
}