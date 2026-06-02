import { PhoneAuthPluginOptions } from './types';
import { SmsService } from './sms.service';
export declare class PhoneAuthResolver {
    private options;
    private smsService;
    constructor(options: PhoneAuthPluginOptions, smsService: SmsService);
    sendPhoneVerificationCode(phoneNumber: string): Promise<boolean>;
}
