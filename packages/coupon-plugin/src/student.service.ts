import { Injectable } from '@nestjs/common';
import { Customer, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

/**
 * 学生认证（人工审核流）：
 * - C 端 applyStudentVerification 提交学校/学号/学生证照片 → studentStatus=pending
 * - 后台 studentVerifications 列表 + reviewStudentVerification 通过/驳回 → approved/rejected
 * - 仅 approved 客户在下单重算时享券模板 studentPrice（见 CouponSaleService）
 */
export interface StudentInfo {
    school?: string;
    studentNo?: string;
    idImg?: string | null;
}

function parseInfo(raw: string | null | undefined): StudentInfo {
    if (!raw) return {};
    try {
        const obj = JSON.parse(raw);
        return typeof obj === 'object' && obj ? obj : {};
    } catch {
        return {};
    }
}

@Injectable()
export class StudentVerificationService {
    constructor(private connection: TransactionalConnection) {}

    private customerRepo(ctx: RequestContext) {
        return this.connection.getRepository(ctx, Customer);
    }

    private statusOf(customer: Customer): string {
        return ((customer as any).customFields?.studentStatus as string) || 'none';
    }

    private toItem(customer: Customer) {
        const info = parseInfo((customer as any).customFields?.studentInfo);
        return {
            customerId: String(customer.id),
            customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.emailAddress,
            customerEmail: customer.emailAddress,
            status: this.statusOf(customer),
            school: info.school ?? null,
            studentNo: info.studentNo ?? null,
            idImg: info.idImg ?? null,
            reviewedAt: (customer as any).customFields?.studentReviewedAt ?? null,
        };
    }

    /** C 端：提交/更新认证申请（approved 后不可重复提交，驳回后可重新提交） */
    async apply(ctx: RequestContext, input: { school: string; studentNo: string; idImg?: string | null }) {
        const school = (input.school ?? '').trim().slice(0, 60);
        const studentNo = (input.studentNo ?? '').trim().slice(0, 40);
        if (!school || !studentNo) {
            throw new UserInputError('school and studentNo are required');
        }
        const repo = this.customerRepo(ctx);
        const customer = await repo.findOne({ where: { id: ctx.activeUserId as number } });
        if (!customer) {
            throw new UserInputError('Customer not found');
        }
        if (this.statusOf(customer) === 'approved') {
            throw new UserInputError('Student verification already approved');
        }
        (customer as any).customFields = {
            ...(customer as any).customFields,
            studentStatus: 'pending',
            studentInfo: JSON.stringify({ school, studentNo, idImg: input.idImg ?? null }),
        };
        await repo.save(customer);
        return this.toItem(customer);
    }

    /** C 端：查本人认证状态 */
    async myStatus(ctx: RequestContext) {
        const customer = await this.customerRepo(ctx).findOne({ where: { id: ctx.activeUserId as number } });
        if (!customer) {
            throw new UserInputError('Customer not found');
        }
        return this.toItem(customer);
    }

    /** 后台：按状态筛选认证列表（缺省返回全部已提交过申请的客户） */
    async list(ctx: RequestContext, status?: string) {
        const statuses = status ? [status] : ['pending', 'approved', 'rejected'];
        // customFields 落在 customer 表真实列（studentStatus），直接按列查询
        const customers = await this.customerRepo(ctx)
            .createQueryBuilder('c')
            .where('c.studentStatus IN (:...statuses)', { statuses })
            .orderBy('c.id', 'DESC')
            .take(200)
            .getMany();
        return customers.map(c => this.toItem(c));
    }

    /** 后台：审核（approve=true → approved；false → rejected）；驳回后客户可重新提交 */
    async review(ctx: RequestContext, customerId: number, approve: boolean) {
        const repo = this.customerRepo(ctx);
        const customer = await repo.findOne({ where: { id: customerId } });
        if (!customer) {
            throw new UserInputError('Customer not found');
        }
        if (this.statusOf(customer) === 'none') {
            throw new UserInputError('Customer has no student verification application');
        }
        (customer as any).customFields = {
            ...(customer as any).customFields,
            studentStatus: approve ? 'approved' : 'rejected',
            studentReviewedAt: new Date(),
        };
        await repo.save(customer);
        return this.toItem(customer);
    }
}
