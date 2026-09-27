import { ID, RequestContext } from '@vendure/core';
import { DeliveryRecordService } from './delivery-record.service';
import { DeliveryState } from './delivery-state';
import { VirtualPhysicalStockService } from '../inventory/virtual-physical-stock.service';
export declare class DeliveryAdminResolver {
    private deliveryRecordService;
    private virtualPhysicalStockService;
    constructor(deliveryRecordService: DeliveryRecordService, virtualPhysicalStockService: VirtualPhysicalStockService);
    deliveryRecords(ctx: RequestContext, orderId?: ID): Promise<import("./delivery-record.entity").DeliveryRecord[]>;
    deliveryTransition(ctx: RequestContext, id: ID, to: DeliveryState): Promise<import("./delivery-record.entity").DeliveryRecord>;
    deliverySetExpress(ctx: RequestContext, id: ID, expressCompany: string, trackingNo: string): Promise<import("./delivery-record.entity").DeliveryRecord>;
    deliveryAssignStaff(ctx: RequestContext, id: ID, staffId: string, staffName?: string): Promise<import("./delivery-record.entity").DeliveryRecord>;
    deliveryCreateTransfer(ctx: RequestContext, orderId: ID, fromLocationId: ID, toLocationId: ID, itemsJson: string): Promise<import("./delivery-record.entity").DeliveryRecord>;
    deliveryTransferArrived(ctx: RequestContext, id: ID): Promise<import("./delivery-record.entity").DeliveryRecord>;
}
