import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';
import { Button } from '@/vdb/components/ui/button.js';
import { SettingsForm, Fields } from '../settings-form.js';
import { tenantSettingsDocument, updateTenantMultiLanguageDocument } from '../tenant-settings.graphql.js';

// operationalCopy 各 stringList 的数组下标与 availableLanguageCodes 一一对应（按语言顺序）。
const fields: Fields = [
    { name: 'availableLanguageCodes', label: '可用语言（每行一项，如 zh_Hans/en）', type: 'stringList' },
    { name: 'defaultLanguageCode', label: '默认语言', type: 'text' },
    { name: 'translationWorkflowEnabled', label: '启用内容翻译工作流', type: 'boolean' },
    {
        group: '运营文案多语言',
        fields: [
            { name: 'operationalCopy.tenantName', label: '租户名称文案（每行一项，与语言顺序对应）', type: 'stringList' },
            { name: 'operationalCopy.serviceNotice', label: '服务公告文案（每行一项，与语言顺序对应）', type: 'stringList' },
            { name: 'operationalCopy.invoiceHeader', label: '单据抬头文案（每行一项，与语言顺序对应）', type: 'stringList' },
        ],
    },
];

export default function MultiLanguageSection({ channelId }: { channelId: string }) {
    const { data, refetch } = useQuery({
        queryKey: ['tenantSettings', channelId],
        queryFn: () => api.query(tenantSettingsDocument, { channelId }),
    });
    const [values, setValues] = useState<Record<string, any>>({});

    const multiLanguage = (data as any)?.tenantSettings?.multiLanguage;
    useEffect(() => {
        if (multiLanguage) setValues(multiLanguage);
    }, [multiLanguage]);

    const mutation = useMutation({
        mutationFn: (patch: Record<string, any>) =>
            api.mutate(updateTenantMultiLanguageDocument, { input: { channelId, patch } }),
        onSuccess: () => refetch(),
    });

    return (
        <div>
            <SettingsForm fields={fields} values={values} onChange={setValues} />
            <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(values)}>
                保存多语言设置
            </Button>
        </div>
    );
}