// packages/cjk-plugin/src/auth/invite-code.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { RequestContext, CustomerService } from '@vendure/core';

export const INVITE_CODE_BOUND = 'INVITE_CODE_BOUND';

export interface BindResult {
    bound: boolean;
    reason?: string;
}

@Injectable()
export class InviteCodeService {
    private readonly logger = new Logger('InviteCodeService');
    constructor(private customerService: CustomerService) {}

    /** 本次仅框架:存 inviteCode 到 Customer.customFields,记日志。奖励发放 TODO */
    async bindIfPresent(ctx: RequestContext, customerId: string, inviteCode: string): Promise<BindResult> {
        if (!inviteCode) return { bound: false, reason: 'no invite code' };
        const customer = await this.customerService.findOne(ctx, customerId as any);
        if (!customer) return { bound: false, reason: 'customer not found' };
        const existing = (customer as any).customFields?.inviteCode;
        if (existing) return { bound: false, reason: 'already bound' };
        await this.customerService.update(ctx, {
            id: customerId as any,
            customFields: { inviteCode },
        });
        this.logger.log(`Invite code bound: customer=${customerId}, code=${inviteCode}`);
        return { bound: true };
    }

    async validate(ctx: RequestContext, _inviteCode: string): Promise<boolean> {
        // TODO: 后续对接 Strapi 校验邀请码有效性
        return true;
    }
}
