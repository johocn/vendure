import { RequestContext, CustomerService } from '@vendure/core';
export declare const INVITE_CODE_BOUND = "INVITE_CODE_BOUND";
export interface BindResult {
    bound: boolean;
    reason?: string;
}
export declare class InviteCodeService {
    private customerService;
    private readonly logger;
    constructor(customerService: CustomerService);
    /** 本次仅框架:存 inviteCode 到 Customer.customFields,记日志。奖励发放 TODO */
    bindIfPresent(ctx: RequestContext, customerId: string, inviteCode: string): Promise<BindResult>;
    validate(ctx: RequestContext, _inviteCode: string): Promise<boolean>;
}
