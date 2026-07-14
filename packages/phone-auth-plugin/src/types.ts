export interface PhoneAuthPluginOptions {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
    codeLength?: number;
    codeExpirySeconds?: number;
    devBypass?: boolean;
    devBypassCode?: string;
}

export interface RegisterCustomerInput {
    phoneNumber?: string;
    code?: string;
    password: string;
    emailAddress?: string;
}
