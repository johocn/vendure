import { Injectable } from '@nestjs/common';
import {
    Customer,
    CustomerService,
    ForbiddenError,
    RequestContext,
    TransactionalConnection,
    UserInputError,
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
        const current = String((customer.customFields as any)?.riderStatus ?? 'none');
        // 已停用账号不得自助复申请（否则改回 pending 可绕过停用）；
        // 已通过审核者仅更新资料，保留 approved（重新提交不能把在职骑手打回待审）
        if (current === 'suspended') throw new UserInputError('骑手账号已停用，请联系管理员');
        const status = current === 'approved' ? 'approved' : 'pending';
        await this.connection.getRepository(ctx, Customer).update(customer.id, {
            customFields: {
                riderStatus: status,
                riderRealName: input.realName,
                riderStudentNo: input.studentNo,
                riderCampus: input.campus,
                riderIdImg: input.idImg ?? null,
            },
        } as any);
        return { status };
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

    /** 骑手上下线开关 + 心跳：大厅轮询页每 15s 调 online=true 即续命 */
    async setOnline(ctx: RequestContext, online: boolean) {
        const customer = await this.requireCustomer(ctx);
        await this.connection.getRepository(ctx, Customer).update(customer.id, {
            customFields: { riderOnlineAt: online ? new Date() : null },
        } as any);
        return { online };
    }

    /**
     * 按 riderStatus 查询入驻申请列表。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径
     * customer.customFields.riderStatus（与 delivery-plugin 的 order.customFields.* 写法一致）。
     * F8 分页：skip/take 由前端传参，take 缺省 200 兜底防全量。
     */
    async listApplications(ctx: RequestContext, status: string, skip?: number, take?: number) {
        // 分页参数钳制：防 GraphQL Int 负数（take<1 生成非法 LIMIT）与超大 take 绕过兜底全量拉取
        const safeSkip = Math.max(0, skip ?? 0);
        const safeTake = Math.min(Math.max(take ?? 200, 1), 500);
        const [items, total] = await this.connection
            .getRepository(ctx, Customer)
            .createQueryBuilder('customer')
            .where('customer.customFields.riderStatus = :status', { status })
            .orderBy('customer.id', 'ASC')
            .skip(safeSkip)
            .take(safeTake)
            .getManyAndCount();
        return { items, total };
    }
}
