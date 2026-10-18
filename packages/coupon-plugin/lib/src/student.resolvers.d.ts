import { RequestContext } from '@vendure/core';
import { StudentVerificationService } from './student.service';
/**
 * 学生认证（人工审核流）resolver：
 * - shop-api：myStudentVerification / applyStudentVerification（登录用户）
 * - admin-api：studentVerifications / reviewStudentVerification（需 UpdateCustomer 权限）
 */
export declare class StudentShopResolver {
    private studentService;
    constructor(studentService: StudentVerificationService);
    myStudentVerification(ctx: RequestContext): Promise<{
        customerId: string;
        customerName: string;
        customerEmail: string;
        status: string;
        school: string | null;
        studentNo: string | null;
        idImg: string | null;
        reviewedAt: any;
    }>;
    applyStudentVerification(ctx: RequestContext, school: string, studentNo: string, idImg?: string): Promise<{
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
export declare class StudentAdminResolver {
    private studentService;
    constructor(studentService: StudentVerificationService);
    studentVerifications(ctx: RequestContext, status?: string): Promise<{
        customerId: string;
        customerName: string;
        customerEmail: string;
        status: string;
        school: string | null;
        studentNo: string | null;
        idImg: string | null;
        reviewedAt: any;
    }[]>;
    reviewStudentVerification(ctx: RequestContext, customerId: string, approve: boolean): Promise<{
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
