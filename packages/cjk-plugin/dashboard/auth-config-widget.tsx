import {
    Button,
    DashboardFormComponent,
    Field,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@vendure/dashboard';
import React, { useEffect, useState } from 'react';

/** struct 形状（来自 customFields.authConfig，DB 层） */
interface AuthConfigStruct {
    enabledMethods?: string[];
    overridesJson?: string;
    ssoProvidersJson?: string;
}

const ALL_METHODS = [
    { key: 'native', label: '账号密码' },
    { key: 'phone', label: '手机号' },
    { key: 'wechat', label: '微信' },
    { key: 'alipay', label: '支付宝' },
    { key: 'douyin', label: '抖音' },
    { key: 'sso', label: 'SSO' },
];

function safeParse<T>(s: string | undefined | null, fallback: T): T {
    if (!s) return fallback;
    try {
        return JSON.parse(s) as T;
    } catch {
        return fallback;
    }
}

function isEmptyObj(v: any): boolean {
    return !v || Object.keys(v).length === 0;
}

export const AuthConfigInput: DashboardFormComponent = props => {
    const { value, onChange, disabled } = props;

    // 内部编辑状态（domain 形状）
    const [enabledMethods, setEnabledMethods] = useState<string[]>(value?.enabledMethods || []);
    const [overrides, setOverrides] = useState<Record<string, any>>(
        safeParse(value?.overridesJson, {}),
    );
    const [ssoProviders, setSsoProviders] = useState<any[]>(
        safeParse(value?.ssoProvidersJson, []),
    );

    // 外部 value 变化时同步内部状态（如切换 channel）
    useEffect(() => {
        setEnabledMethods(value?.enabledMethods || []);
        setOverrides(safeParse(value?.overridesJson, {}));
        setSsoProviders(safeParse(value?.ssoProvidersJson, []));
    }, [value]);

    // 把 domain 编辑状态整体回写为 struct 形状
    const emit = (
        nextMethods: string[],
        nextOverrides: Record<string, any>,
        nextProviders: any[],
    ) => {
        setEnabledMethods(nextMethods);
        setOverrides(nextOverrides);
        setSsoProviders(nextProviders);
        onChange({
            enabledMethods: nextMethods,
            overridesJson: JSON.stringify(nextOverrides),
            ssoProvidersJson: JSON.stringify(nextProviders),
        });
    };

    const toggleMethod = (method: string) => {
        const has = enabledMethods.includes(method);
        const next = has
            ? enabledMethods.filter(m => m !== method)
            : [...enabledMethods, method];
        emit(next, overrides, ssoProviders);
    };

    const updateOverride = (method: string, field: string, val: string) => {
        const current = overrides[method] || {};
        const nextOverrides = {
            ...overrides,
            [method]: { ...current, [field]: val },
        };
        emit(enabledMethods, nextOverrides, ssoProviders);
    };

    const addSsoProvider = () => {
        const next = [
            ...ssoProviders,
            {
                name: '',
                providerKey: '',
                protocol: 'zhao-sso',
                baseUrl: '',
                clientId: '',
                clientSecret: '***',
                scopes: [],
            },
        ];
        emit(enabledMethods, overrides, next);
    };

    const updateSsoProvider = (index: number, field: string, val: any) => {
        const next = ssoProviders.map((p, i) =>
            i === index ? { ...p, [field]: val } : p,
        );
        emit(enabledMethods, overrides, next);
    };

    const removeSsoProvider = (index: number) => {
        const next = ssoProviders.filter((_, i) => i !== index);
        emit(enabledMethods, overrides, next);
    };

    const overridesConfig: Array<{
        method: string;
        title: string;
        fields: Array<{ key: string; label: string; secret?: boolean }>;
    }> = [
        {
            method: 'phone',
            title: '手机号凭证覆盖',
            fields: [
                { key: 'accessKeyId', label: 'AccessKeyId' },
                { key: 'accessKeySecret', label: 'AccessKeySecret', secret: true },
                { key: 'signName', label: '签名' },
                { key: 'templateCode', label: '模板Code' },
            ],
        },
        {
            method: 'wechat',
            title: '微信凭证覆盖',
            fields: [
                { key: 'appId', label: 'AppId' },
                { key: 'appSecret', label: 'AppSecret', secret: true },
                { key: 'miniProgramAppId', label: '小程序AppId' },
                { key: 'miniProgramAppSecret', label: '小程序AppSecret', secret: true },
                { key: 'token', label: '公众号Token' },
                { key: 'encodingAESKey', label: 'EncodingAESKey', secret: true },
            ],
        },
        {
            method: 'alipay',
            title: '支付宝凭证覆盖',
            fields: [
                { key: 'appId', label: 'AppId' },
                { key: 'privateKey', label: 'PrivateKey', secret: true },
                { key: 'miniProgramAppId', label: '小程序AppId' },
            ],
        },
        {
            method: 'douyin',
            title: '抖音凭证覆盖',
            fields: [
                { key: 'appId', label: 'AppId' },
                { key: 'appSecret', label: 'AppSecret', secret: true },
                { key: 'miniProgramAppId', label: '小程序AppId' },
                { key: 'miniProgramAppSecret', label: '小程序AppSecret', secret: true },
            ],
        },
    ];

    return (
        <div className="space-y-4 border rounded-md p-4">
            <div>
                <FieldLabel>启用的登录方式</FieldLabel>
                <div className="flex flex-wrap gap-4 mt-2">
                    {ALL_METHODS.map(m => (
                        <label key={m.key} className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={enabledMethods.includes(m.key)}
                                onChange={() => toggleMethod(m.key)}
                                disabled={disabled}
                            />
                            <span>
                                {m.label} ({m.key})
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* 各方式凭证覆盖 */}
            {overridesConfig.map(cfg => {
                if (!enabledMethods.includes(cfg.method)) return null;
                const current = overrides[cfg.method] || {};
                const isMissing = isEmptyObj(current);
                return (
                    <details key={cfg.method} className="border rounded-md">
                        <summary className="cursor-pointer px-3 py-2 font-medium">
                            {cfg.title}
                            {isMissing && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                    （留空使用平台默认）
                                </span>
                            )}
                        </summary>
                        <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 p-3">
                            {cfg.fields.map(f => (
                                <Field key={f.key}>
                                    <FieldLabel>{f.label}</FieldLabel>
                                    <Input
                                        value={current[f.key] ?? ''}
                                        placeholder={f.secret ? '*** 保留原值' : ''}
                                        onChange={e =>
                                            updateOverride(cfg.method, f.key, e.target.value)
                                        }
                                        disabled={disabled}
                                    />
                                </Field>
                            ))}
                        </div>
                    </details>
                );
            })}

            {/* SSO Providers */}
            {enabledMethods.includes('sso') && (
                <div className="space-y-3">
                    <FieldLabel>SSO Providers</FieldLabel>
                    {ssoProviders.map((p, i) => (
                        <div key={i} className="border rounded-md p-3 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-sm">
                                    Provider #{i + 1}
                                    {p.providerKey ? ` - ${p.providerKey}` : ''}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSsoProvider(i)}
                                    disabled={disabled}
                                >
                                    删除
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                                <Field>
                                    <FieldLabel>显示名</FieldLabel>
                                    <Input
                                        value={p.name ?? ''}
                                        onChange={e => updateSsoProvider(i, 'name', e.target.value)}
                                        disabled={disabled}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel>标识 (providerKey)</FieldLabel>
                                    <Input
                                        value={p.providerKey ?? ''}
                                        onChange={e =>
                                            updateSsoProvider(i, 'providerKey', e.target.value)
                                        }
                                        disabled={disabled}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel>协议</FieldLabel>
                                    <Select
                                        value={p.protocol ?? 'zhao-sso'}
                                        onValueChange={v => updateSsoProvider(i, 'protocol', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="zhao-sso">zhao-sso</SelectItem>
                                            <SelectItem value="oauth2">oauth2</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel>BaseUrl</FieldLabel>
                                    <Input
                                        value={p.baseUrl ?? ''}
                                        onChange={e =>
                                            updateSsoProvider(i, 'baseUrl', e.target.value)
                                        }
                                        disabled={disabled}
                                    />
                                </Field>
                            </div>

                            {/* 协议特定字段 */}
                            {p.protocol === 'oauth2' && (
                                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                                    <Field>
                                        <FieldLabel>AuthorizeUrl</FieldLabel>
                                        <Input
                                            value={p.authorizeUrl ?? ''}
                                            onChange={e =>
                                                updateSsoProvider(i, 'authorizeUrl', e.target.value)
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel>TokenUrl</FieldLabel>
                                        <Input
                                            value={p.tokenUrl ?? ''}
                                            onChange={e =>
                                                updateSsoProvider(i, 'tokenUrl', e.target.value)
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel>UserInfoUrl</FieldLabel>
                                        <Input
                                            value={p.userInfoUrl ?? ''}
                                            onChange={e =>
                                                updateSsoProvider(i, 'userInfoUrl', e.target.value)
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel>Scopes（逗号分隔）</FieldLabel>
                                        <Input
                                            value={(p.scopes || []).join(',')}
                                            onChange={e =>
                                                updateSsoProvider(
                                                    i,
                                                    'scopes',
                                                    e.target.value
                                                        .split(',')
                                                        .map(s => s.trim())
                                                        .filter(Boolean),
                                                )
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                </div>
                            )}

                            <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                                <Field>
                                    <FieldLabel>
                                        {p.protocol === 'zhao-sso'
                                            ? 'AppCode (clientId)'
                                            : 'ClientId'}
                                    </FieldLabel>
                                    <Input
                                        value={p.clientId ?? ''}
                                        onChange={e =>
                                            updateSsoProvider(i, 'clientId', e.target.value)
                                        }
                                        disabled={disabled}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel>
                                        {p.protocol === 'zhao-sso'
                                            ? 'AppSecret'
                                            : 'ClientSecret'}
                                    </FieldLabel>
                                    <Input
                                        value={p.clientSecret ?? ''}
                                        placeholder="*** 保留原值"
                                        onChange={e =>
                                            updateSsoProvider(i, 'clientSecret', e.target.value)
                                        }
                                        disabled={disabled}
                                    />
                                </Field>
                                {p.protocol === 'zhao-sso' && (
                                    <Field>
                                        <FieldLabel>ChannelCode</FieldLabel>
                                        <Input
                                            value={p.channelCode ?? ''}
                                            onChange={e =>
                                                updateSsoProvider(i, 'channelCode', e.target.value)
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                )}
                            </div>

                            {/* 字段映射（可选） */}
                            <details>
                                <summary className="cursor-pointer text-sm text-muted-foreground">
                                    字段映射（可选，留空用默认）
                                </summary>
                                <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 p-2">
                                    <Field>
                                        <FieldLabel>外部ID字段</FieldLabel>
                                        <Input
                                            value={p.userInfoMapping?.externalIdField ?? ''}
                                            placeholder={
                                                p.protocol === 'zhao-sso' ? 'uuid' : 'sub'
                                            }
                                            onChange={e =>
                                                updateSsoProvider(i, 'userInfoMapping', {
                                                    ...(p.userInfoMapping || {}),
                                                    externalIdField: e.target.value,
                                                })
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel>邮箱字段</FieldLabel>
                                        <Input
                                            value={p.userInfoMapping?.emailField ?? ''}
                                            placeholder="email"
                                            onChange={e =>
                                                updateSsoProvider(i, 'userInfoMapping', {
                                                    ...(p.userInfoMapping || {}),
                                                    emailField: e.target.value,
                                                })
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel>昵称字段</FieldLabel>
                                        <Input
                                            value={p.userInfoMapping?.nicknameField ?? ''}
                                            placeholder={
                                                p.protocol === 'zhao-sso' ? 'nickname' : 'name'
                                            }
                                            onChange={e =>
                                                updateSsoProvider(i, 'userInfoMapping', {
                                                    ...(p.userInfoMapping || {}),
                                                    nicknameField: e.target.value,
                                                })
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel>手机号字段</FieldLabel>
                                        <Input
                                            value={p.userInfoMapping?.mobileField ?? ''}
                                            placeholder="mobile"
                                            onChange={e =>
                                                updateSsoProvider(i, 'userInfoMapping', {
                                                    ...(p.userInfoMapping || {}),
                                                    mobileField: e.target.value,
                                                })
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel>头像字段</FieldLabel>
                                        <Input
                                            value={p.userInfoMapping?.avatarField ?? ''}
                                            placeholder="avatar_url"
                                            onChange={e =>
                                                updateSsoProvider(i, 'userInfoMapping', {
                                                    ...(p.userInfoMapping || {}),
                                                    avatarField: e.target.value,
                                                })
                                            }
                                            disabled={disabled}
                                        />
                                    </Field>
                                </div>
                            </details>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={addSsoProvider}
                        disabled={disabled}
                    >
                        + 添加 SSO Provider
                    </Button>
                </div>
            )}
        </div>
    );
};

AuthConfigInput.metadata = {
    isFullWidth: true,
};
