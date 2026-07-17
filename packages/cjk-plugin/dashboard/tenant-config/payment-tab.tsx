import { SectionCard } from './shared/section-card';
import { MaskedInput } from './shared/masked-input';

interface Props {
    data: any;
    canEdit: boolean;
    onSave: (patch: any) => Promise<any>;
}

export function PaymentTab({ data, canEdit, onSave }: Props) {
    const handleSave = (platform: string, field: string, value: string) => {
        onSave({ payPatch: { [platform]: { [field]: value } } });
    };
    return (
        <div>
            <SectionCard title="微信支付">
                <MaskedInput label="appId" value={data?.wechatpay?.appId} disabled={!canEdit} onCommit={v => handleSave('wechatpay', 'appId', v)} />
                <MaskedInput label="mchId" value={data?.wechatpay?.mchId} disabled={!canEdit} onCommit={v => handleSave('wechatpay', 'mchId', v)} />
                <MaskedInput label="privateKey" value={data?.wechatpay?.privateKey} disabled={!canEdit} onCommit={v => handleSave('wechatpay', 'privateKey', v)} />
                <MaskedInput label="apiKey" value={data?.wechatpay?.apiKey} disabled={!canEdit} onCommit={v => handleSave('wechatpay', 'apiKey', v)} />
                <MaskedInput label="serialNo" value={data?.wechatpay?.serialNo} disabled={!canEdit} onCommit={v => handleSave('wechatpay', 'serialNo', v)} />
                <MaskedInput label="publicKey" value={data?.wechatpay?.publicKey} disabled={!canEdit} onCommit={v => handleSave('wechatpay', 'publicKey', v)} />
            </SectionCard>
            <SectionCard title="抖音支付">
                <MaskedInput label="appId" value={data?.douyinpay?.appId} disabled={!canEdit} onCommit={v => handleSave('douyinpay', 'appId', v)} />
                <MaskedInput label="appSecret" value={data?.douyinpay?.appSecret} disabled={!canEdit} onCommit={v => handleSave('douyinpay', 'appSecret', v)} />
                <MaskedInput label="mchId" value={data?.douyinpay?.mchId} disabled={!canEdit} onCommit={v => handleSave('douyinpay', 'mchId', v)} />
                <MaskedInput label="privateKey" value={data?.douyinpay?.privateKey} disabled={!canEdit} onCommit={v => handleSave('douyinpay', 'privateKey', v)} />
                <MaskedInput label="salt" value={data?.douyinpay?.salt} disabled={!canEdit} onCommit={v => handleSave('douyinpay', 'salt', v)} />
            </SectionCard>
            <SectionCard title="支付宝">
                <MaskedInput label="appId" value={data?.alipay?.appId} disabled={!canEdit} onCommit={v => handleSave('alipay', 'appId', v)} />
                <MaskedInput label="privateKey" value={data?.alipay?.privateKey} disabled={!canEdit} onCommit={v => handleSave('alipay', 'privateKey', v)} />
            </SectionCard>
        </div>
    );
}
