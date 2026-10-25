import { Customer, CustomerService, RequestContext, TransactionalConnection } from '@vendure/core';
import { RiderOpsService } from './rider-ops.service';
export declare class RiderService {
    private connection;
    private customerService;
    private riderOps;
    constructor(connection: TransactionalConnection, customerService: CustomerService, riderOps: RiderOpsService);
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
    /** 骑手归属渠守卫：Customer 的渠道是多对多，必须 join customer.channels。
     * 否则 A 店审核员可按 customerId 查看/停用 B 店骑手（含学号、证件照）。 */
    private assertCustomerInChannel;
    setRiderStatus(ctx: RequestContext, customerId: number, status: 'approved' | 'suspended' | 'none'): Promise<{
        status: "approved" | "none" | "suspended";
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
    /** 骑手上下线开关 + 心跳：大厅轮询页每 15s 调 online=true 即续命 */
    setOnline(ctx: RequestContext, online: boolean): Promise<{
        online: boolean;
    }>;
    /**
     * 按 riderStatus 查询入驻申请列表。
     * customFields 为嵌入式物理列，QueryBuilder 用 embedded 路径
     * customer.customFields.riderStatus（与 delivery-plugin 的 order.customFields.* 写法一致）。
     * F8 分页：skip/take 由前端传参，take 缺省 200 兜底防全量。
     */
    listApplications(ctx: RequestContext, status: string, skip?: number, take?: number): Promise<{
        items: Customer[];
        total: number;
    }>;
}
