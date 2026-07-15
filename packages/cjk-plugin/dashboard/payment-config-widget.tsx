import {
    Field,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@vendure/dashboard';
import { DashboardFormComponent } from '@vendure/dashboard';
import React, { useEffect, useState } from 'react';

interface PayConfigStruct {
    alipayJson?: string;
    wechatpayJson?: string;
}

interface AlipayCreds {
    appId?: string;
    privateKey?: string;
    tradeType?: string;
}

interface WechatpayCreds {
    appId?: string;
    mchId?: string;
    publicKey?: string;
    privateKey?: string;
    apiKey?: string;
    serialNo?: string;
    tradeType?: string;
}

function safeParse<T>(s: string | undefined | null, fallback: T): T {
    if (!s) return fallback;
    try {
        return JSON.parse(s) as T;
    } catch {
        return fallback;
    }
}

export const PaymentConfigInput: DashboardFormComponent = props => {
    const { value, onChange, disabled } = props;

    const [alipay, setAlipay] = useState<AlipayCreds>(safeParse(value?.alipayJson, {}));
    const [wechatpay, setWechatpay] = useState<WechatpayCreds>(safeParse(value?.wechatpayJson, {}));

    useEffect(() => {
        setAlipay(safeParse(value?.alipayJson, {}));
        setWechatpay(safeParse(value?.wechatpayJson, {}));
    }, [value]);

    const emit = (nextAlipay: AlipayCreds, nextWechatpay: WechatpayCreds) => {
        setAlipay(nextAlipay);
        setWechatpay(nextWechatpay);
        onChange({
            alipayJson: JSON.stringify(nextAlipay),
            wechatpayJson: JSON.stringify(nextWechatpay),
        });
    };

    const updateAlipay = (field: string, val: string) => {
        emit({ ...alipay, [field]: val }, wechatpay);
    };

    const updateWechatpay = (field: string, val: string) => {
        emit(alipay, { ...wechatpay, [field]: val });
    };

    return (
        <div className="space-y-4 border rounded-md p-4">
            <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 font-medium">
                    支付宝配置
                    {!alipay.appId && (
                        <span className="ml-2 text-xs text-muted-foreground">（未配置）</span>
                    )}
                </summary>
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 p-3">
                    <Field>
                        <FieldLabel>AppId</FieldLabel>
                        <Input
                            value={alipay.appId ?? ''}
                            onChange={e => updateAlipay('appId', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>交易类型</FieldLabel>
                        <Select
                            value={alipay.tradeType ?? 'PAGE'}
                            onValueChange={v => updateAlipay('tradeType', v)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PAGE">PAGE</SelectItem>
                                <SelectItem value="WAP">WAP</SelectItem>
                                <SelectItem value="APP">APP</SelectItem>
                                <SelectItem value="MINI">MINI</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field className="@md:col-span-2">
                        <FieldLabel>应用私钥 (PrivateKey)</FieldLabel>
                        <Input
                            type="password"
                            value={alipay.privateKey ?? ''}
                            placeholder="*** 留空不修改"
                            onChange={e => updateAlipay('privateKey', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                </div>
            </details>

            <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 font-medium">
                    微信支付配置
                    {!wechatpay.appId && (
                        <span className="ml-2 text-xs text-muted-foreground">（未配置）</span>
                    )}
                </summary>
                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 p-3">
                    <Field>
                        <FieldLabel>AppId</FieldLabel>
                        <Input
                            value={wechatpay.appId ?? ''}
                            onChange={e => updateWechatpay('appId', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>商户号 (mchId)</FieldLabel>
                        <Input
                            value={wechatpay.mchId ?? ''}
                            onChange={e => updateWechatpay('mchId', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>证书序列号</FieldLabel>
                        <Input
                            value={wechatpay.serialNo ?? ''}
                            onChange={e => updateWechatpay('serialNo', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field>
                        <FieldLabel>交易类型</FieldLabel>
                        <Select
                            value={wechatpay.tradeType ?? 'JSAPI'}
                            onValueChange={v => updateWechatpay('tradeType', v)}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="JSAPI">JSAPI</SelectItem>
                                <SelectItem value="NATIVE">NATIVE</SelectItem>
                                <SelectItem value="APP">APP</SelectItem>
                                <SelectItem value="H5">H5</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field className="@md:col-span-2">
                        <FieldLabel>微信平台公钥 (PEM)</FieldLabel>
                        <Input
                            type="password"
                            value={wechatpay.publicKey ?? ''}
                            placeholder="*** 留空不修改"
                            onChange={e => updateWechatpay('publicKey', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field className="@md:col-span-2">
                        <FieldLabel>商户私钥 (PEM)</FieldLabel>
                        <Input
                            type="password"
                            value={wechatpay.privateKey ?? ''}
                            placeholder="*** 留空不修改"
                            onChange={e => updateWechatpay('privateKey', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                    <Field className="@md:col-span-2">
                        <FieldLabel>APIv3 密钥</FieldLabel>
                        <Input
                            type="password"
                            value={wechatpay.apiKey ?? ''}
                            placeholder="*** 留空不修改"
                            onChange={e => updateWechatpay('apiKey', e.target.value)}
                            disabled={disabled}
                        />
                    </Field>
                </div>
            </details>
        </div>
    );
};
