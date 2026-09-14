import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { Sale } from '@vendure/core';
import { DeliveryRecord } from './delivery-record.entity';
import { DeliveryMode, DeliveryState } from './delivery-state';
export declare class DeliveryRecordService {
    private connection;
    constructor(connection: TransactionalConnection);
    private physicalEnabled;
    /** 依 SALE 事件生成顾客配送记录：按 orderId+sourceLocationId 分组，幂等防重 */
    createFromSales(ctx: RequestContext, sales: Sale[]): Promise<DeliveryRecord[]>;
    /** 状态流转（校验合法迁移 + 记录时间戳） */
    transition(ctx: RequestContext, id: ID, to: DeliveryState): Promise<DeliveryRecord>;
    /** 快递录单 */
    setExpress(ctx: RequestContext, id: ID, expressCompany: string, trackingNo: string): Promise<DeliveryRecord>;
    /** 自营指派 */
    assignStaff(ctx: RequestContext, id: ID, staffId: string, staffName?: string): Promise<DeliveryRecord>;
    /** 自提点模式重设（pickup 订单发货时调用） */
    markAsPickup(ctx: RequestContext, id: ID, pickupLocationId: ID, mode?: DeliveryMode): Promise<DeliveryRecord>;
    /** 按订单查询配送记录（不传订单则返回全部） */
    findByOrder(ctx: RequestContext, orderId?: ID): Promise<DeliveryRecord[]>;
    /** 创建内部配送（transfer）：主仓 -> 自提点仓 */
    createTransfer(ctx: RequestContext, input: {
        orderId: ID;
        fromLocationId: ID;
        toLocationId: ID;
        items: Array<{
            variantId: ID;
            quantity: number;
        }>;
        expressCompany?: string;
        trackingNo?: string;
    }): Promise<DeliveryRecord>;
    /** transfer 到达：入自提点仓（toLocationId），触发 A 镜像 */
    markTransferArrived(ctx: RequestContext, id: ID, adjustStockPublic: (ctx: RequestContext, variantId: ID, locationId: ID, delta: number, reason: string, meta?: any) => Promise<void>): Promise<DeliveryRecord>;
}
