import { RequestContext, TransactionalConnection } from '@vendure/core';
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
export declare class StudentVerificationService {
    private connection;
    constructor(connection: TransactionalConnection);
    private customerRepo;
    private statusOf;
    private toItem;
    /** C 端：提交/更新认证申请（approved 后不可重复提交，驳回后可重新提交） */
    apply(ctx: RequestContext, input: {
        school: string;
        studentNo: string;
        idImg?: string | null;
    }): Promise<{
        customerId: string;
        customerName: string;
        customerEmail: string;
        status: string;
        school: string | null;
        studentNo: string | null;
        idImg: string | null;
        reviewedAt: any;
    }>;
    /** C 端：查本人认证状态 */
    myStatus(ctx: RequestContext): Promise<{
        customerId: string;
        customerName: string;
        customerEmail: string;
        status: string;
        school: string | null;
        studentNo: string | null;
        idImg: string | null;
        reviewedAt: any;
    }>;
    /** 后台：按状态筛选认证列表（缺省返回全部已提交过申请的客户） */
    list(ctx: RequestContext, status?: string): Promise<{
        customerId: string;
        customerName: string;
        customerEmail: string;
        status: string;
        school: string | null;
        studentNo: string | null;
        idImg: string | null;
        reviewedAt: any;
    }[]>;
    /** 后台：审核（approve=true → approved；false → rejected）；驳回后客户可重新提交 */
    review(ctx: RequestContext, customerId: number, approve: boolean): Promise<{
        customerId: string;
        customerName: string;
        customerEmail: string;
        status: string;
        school: string | null;
        studentNo: string | null;
        idImg: string | null;
        reviewedAt: any;
    }>;
}
