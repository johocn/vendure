import { SectionCard } from './shared/section-card';
import { MaskedInput } from './shared/masked-input';

interface Props {
    data: any;
    canEdit: boolean;
    onSave: (patch: any) => Promise<any>;
}

export function WechatAuthTab({ data, canEdit, onSave }: Props) {
    const wechat = data?.overrides?.wechat || {};
    const handleSave = (field: string, value: string) => {
        onSave({ authPatch: { overrides: { wechat: { [field]: value } } } });
    };
    const handleMethodToggle = (enabled: boolean) => {
        const methods = new Set(data?.enabledMethods || []);
        if (enabled) methods.add('wechat'); else methods.delete('wechat');
        onSave({ authPatch: { enabledMethods: Array.from(methods) } });
    };
    return (
        <div>
            <SectionCard title="启用状态">
                <label>
                    <input
                        type="checkbox"
                        checked={(data?.enabledMethods || []).includes('wechat')}
                        disabled={!canEdit}
                        onChange={e => handleMethodToggle(e.target.checked)}
                    />
                    启用微信登录
                </label>
            </SectionCard>
            <SectionCard title="公众号配置">
                <MaskedInput label="appId" value={wechat.appId} disabled={!canEdit} onCommit={v => handleSave('appId', v)} />
                <MaskedInput label="appSecret" value={wechat.appSecret} disabled={!canEdit} onCommit={v => handleSave('appSecret', v)} />
                <MaskedInput label="token(消息校验)" value={wechat.token} disabled={!canEdit} onCommit={v => handleSave('token', v)} />
                <MaskedInput label="encodingAESKey(通信加密密钥)" value={wechat.encodingAESKey} disabled={!canEdit} onCommit={v => handleSave('encodingAESKey', v)} />
            </SectionCard>
            <SectionCard title="小程序配置">
                <MaskedInput label="miniProgramAppId" value={wechat.miniProgramAppId} disabled={!canEdit} onCommit={v => handleSave('miniProgramAppId', v)} />
                <MaskedInput label="miniProgramAppSecret" value={wechat.miniProgramAppSecret} disabled={!canEdit} onCommit={v => handleSave('miniProgramAppSecret', v)} />
            </SectionCard>
        </div>
    );
}
