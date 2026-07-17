import { SectionCard } from './shared/section-card';
import { MaskedInput } from './shared/masked-input';

interface Props {
    data: any;
    canEdit: boolean;
    onSave: (patch: any) => Promise<any>;
}

export function MapTab({ data, canEdit, onSave }: Props) {
    const handleSave = (field: string, value: string) => {
        onSave({ mapPatch: { [field]: value } });
    };
    return (
        <SectionCard title="地图配置">
            <div>
                <label>provider</label>
                <select value={data?.provider} disabled={!canEdit} onChange={e => handleSave('provider', e.target.value)}>
                    <option value="amap">高德(amap)</option>
                    <option value="tencent">腾讯(tencent)</option>
                    <option value="baidu">百度(baidu)</option>
                </select>
            </div>
            <MaskedInput label="apiKey" value={data?.apiKey} disabled={!canEdit} onCommit={v => handleSave('apiKey', v)} />
            {data?.provider === 'amap' && (
                <MaskedInput label="securityJsCode" value={data?.securityJsCode} disabled={!canEdit} onCommit={v => handleSave('securityJsCode', v)} />
            )}
        </SectionCard>
    );
}
