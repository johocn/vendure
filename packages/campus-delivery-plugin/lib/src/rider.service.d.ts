import { Customer, CustomerService, RequestContext, TransactionalConnection } from '@vendure/core';
export declare class RiderService {
    private connection;
    private customerService;
    constructor(connection: TransactionalConnection, customerService: CustomerService);
    /** 当前登录顾客；未登录或无对应顾客一律 ForbiddenError。 */
    private requireCustomer;
    applyRider(ctx: RequestContext, input: {
        realName: string;
        studentNo: string;
        campus: string;
        idImg?: string;
    }): Promise<{
        status: string;
    }>;
    setRiderStatus(ctx: RequestContext, customerId: number, status: 'approved' | 'suspended' | 'none'): Promise<{
        status: "approved" | "suspended" | "none";
    }>;
    assertApprovedRider(ctx: RequestContext): Promise<Customer>;
    myRiderProfile(ctx: RequestContext): Promise<{
        customerId: import("@vendure/core").ID;
        riderStatus: any;
        riderRealName: any;
        riderStudentNo: any;
        riderCampus: any;
        riderCredit: any;
    }>;
    /**
     * 按 riderStatus 查询入驻申请列表。
     * 注：customFields 存储有两种可能——PG JSON 取法与扁平列取法，部署冒烟时择一：
     * 1. JSON 取法（默认采用）：customer.customFields ->> 'riderStatus' = :status
     * 2. 扁平列备选写法：'"customer"."riderStatus" = :status'
     */
    listApplications(ctx: RequestContext, status: string): Promise<Customer[]>;
}
