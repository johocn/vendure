import { CustomerService, RequestContext, UserService } from '@vendure/core';
import { PhoneAuthPluginOptions, RegisterCustomerInput } from './types';
import { SmsService } from './sms.service';
export declare class PhoneAuthResolver {
    private options;
    private smsService;
    private customerService;
    private userService;
    constructor(options: PhoneAuthPluginOptions, smsService: SmsService, customerService: CustomerService, userService: UserService);
    sendPhoneVerificationCode(ctx: RequestContext, phoneNumber: string): Promise<boolean>;
    registerCustomer(ctx: RequestContext, args: {
        input: RegisterCustomerInput;
    }): Promise<{
        success: boolean;
    }>;
    resetPasswordWithPhoneCode(ctx: RequestContext, phoneNumber: string, code: string, newPassword: string): Promise<boolean>;
}
