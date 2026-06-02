import { PhoneAuthPluginOptions } from './types';
export declare class SmsService {
    private client;
    private signName;
    private templateCode;
    private codeLength;
    private codeExpirySeconds;
    private codeStore;
    constructor(options: PhoneAuthPluginOptions);
    sendVerificationCode(phoneNumber: string): Promise<boolean>;
    verifyCode(phoneNumber: string, code: string): boolean;
    private generateCode;
}
