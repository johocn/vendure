export interface PhoneAuthPluginOptions {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
    codeLength?: number;
    codeExpirySeconds?: number;
}
