import { CustomerService, RequestContext } from '@vendure/core';
import { PhoneAuthPluginOptions, RegisterCustomerInput } from './types';
import { SmsService } from './sms.service';
export declare class PhoneAuthResolver {
    private options;
    private smsService;
    private customerService;
    constructor(options: PhoneAuthPluginOptions, smsService: SmsService, customerService: CustomerService);
    sendPhoneVerificationCode(phoneNumber: string): Promise<boolean>;
    registerCustomer(ctx: RequestContext, args: {
        input: RegisterCustomerInput;
    }): Promise<{
        success: boolean;
    }>;
}
