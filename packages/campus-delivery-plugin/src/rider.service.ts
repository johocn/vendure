import { Injectable } from '@nestjs/common';
import {
    Customer,
    CustomerService,
    ForbiddenError,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';

const CREDIT_LIMIT = 60;

@Injectable()
export class RiderService {
    constructor(private connection: TransactionalConnection, private customerService: CustomerService) {}

    /** 当前登录顾客；未登录或无对应顾客一律 ForbiddenError。 */
    private async requireCustomer(ctx: RequestContext): Promise<Customer> {
        if (!ctx.activeUserId) {
            throw new ForbiddenError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new ForbiddenError();
        }
        return customer;
    }

    async applyRider(ctx: RequestContext, input: { realName: string; studentNo: string; campus: string; idImg?: string }) {
        const customer = await this.requireCustomer(ctx);
        await this.connection.getRepository(ctx, Customer).update(customer.id, {
            customFields: {
                riderStatus: 'pending',
                riderRealName: input.realName,
                riderStudentNo: input.studentNo,
                riderCampus: input.campus,
                riderIdImg: input.idImg ?? null,
            },
        } as any);
        return { status: 'pending' };
    }

    async setRiderStatus(ctx: RequestContext, customerId: number, status: 'approved' | 'suspended' | 'none') {
        await this.connection.getRepository(ctx, Customer).update(customerId, {
            customFields: { riderStatus: status },
        } as any);
        return { status };
    }

    async assertApprovedRider(ctx: RequestContext) {
        const customer = await this.requireCustomer(ctx);
        const cf = customer.customFields as any;
        if (cf.riderStatus !== 'approved') {
            throw new ForbiddenError();
        }
        if ((cf.riderCredit ?? 100) < CREDIT_LIMIT) {
            throw new ForbiddenError();
        }
        return customer;
    }

    async myRiderProfile(ctx: RequestContext) {
        const customer = await this.requireCustomer(ctx);
        const cf = (customer.customFields ?? {}) as any;
        return {
            customerId: customer.id,
            riderStatus: cf.riderStatus ?? null,
            riderRealName: cf.riderRealName ?? null,
            riderStudentNo: cf.riderStudentNo ?? null,
            riderCampus: cf.riderCampus ?? null,
            riderCredit: cf.riderCredit ?? null,
        };
    }

    /**
     * 按 riderStatus 查询入驻申请列表。
     * 注：customFields 存储有两种可能——PG JSON 取法与扁平列取法，部署冒烟时择一：
     * 1. JSON 取法（默认采用）：customer.customFields ->> 'riderStatus' = :status
     * 2. 扁平列备选写法：'"customer"."riderStatus" = :status'
     */
    async listApplications(ctx: RequestContext, status: string) {
        return this.connection
            .getRepository(ctx, Customer)
            .createQueryBuilder('customer')
            .where("customer.customFields ->> 'riderStatus' = :status", { status })
            .getMany();
    }
}
