import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/vdb/graphql/api.js';
import { Button } from '@/vdb/components/ui/button.js';
import { SettingsForm, Fields } from '../settings-form.js';
import { tenantSettingsDocument, updateTenantConfigDocument } from '../tenant-settings.graphql.js';

const fields: Fields = [
    { name: 'provider', label: '地图服务商（amap/baidu/tencent）', type: 'text' },
    { name: 'apiKey', label: 'API Key', type: 'password' },
    { name: 'securityJsCode', label: '安全密钥', type: 'password' },
];

export default function MapSection({ channelId }: { channelId: string }) {
    const { data, refetch } = useQuery({
        queryKey: ['tenantSettings', channelId],
        queryFn: () => api.query(tenantSettingsDocument, { channelId }),
    });
    const [values, setValues] = useState<Record<string, any>>({});

    const map = (data as any)?.tenantSettings?.map;
    useEffect(() => {
        if (map) setValues(map);
    }, [map]);

    const mutation = useMutation({
        mutationFn: (patch: Record<string, any>) =>
            api.mutate(updateTenantConfigDocument, { input: { channelId, mapPatch: patch } }),
        onSuccess: () => refetch(),
    });

    return (
        <div>
            <SettingsForm fields={fields} values={values} onChange={setValues} />
            <Button className="mt-4" disabled={mutation.isPending} onClick={() => mutation.mutate(values)}>
                保存地图设置
            </Button>
        </div>
    );
}