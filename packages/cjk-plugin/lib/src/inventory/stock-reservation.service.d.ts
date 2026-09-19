import { EventBus, ID, RequestContext, StockLevelService, TransactionalConnection } from '@vendure/core';
import { StockReservationEntity } from './stock-reservation.entity';
import { FulfillType, StockReservationItemEntity } from './stock-reservation-item.entity';
import { VirtualPhysicalStockService } from './virtual-physical-stock.service';
export interface ReservationSplit {
    locationId: ID;
    fulfillType: FulfillType;
    qty: number;
}
/**
 * 多仓拆分发货预留单：
 * - reserveOnOrder：下单预占（Order/DeliveryType 归一），建头单 PENDING_ALLOC
 * - allocate：逐仓拆分 item，守恒校验 + 单仓物理 onHand 校验，头→ALLOCATED
 * - fulfill：核销/发货（扣物理仓由 Vendure core 在 SALE 时完成），item→DONE，全 DONE→头 DONE
 * - release：取消/退款对称释放，头→RELEASED
 * - reconcileScan：对账 Σ物理 − 虚拟 == ΣPENDING item qty
 *
 * 接线：事件托盘复用 virtual-physical-stock.service 的 StockMovementEvent 链路——
 * ALLOCATION=下单预占、SALE=发货/自提核销、CANCELLATION/RELEASE=取消/退款。
 */
export declare class StockReservationService {
    private conn;
    private stockLevelService;
    private virtualPhysicalStockService;
    private eventBus;
    constructor(conn: TransactionalConnection, stockLevelService: StockLevelService, virtualPhysicalStockService: VirtualPhysicalStockService, eventBus: EventBus);
    private repo;
    private itemRepo;
    get(ctx: RequestContext, id: number): Promise<StockReservationEntity>;
    findByOrderLine(ctx: RequestContext, orderLineId: ID): Promise<StockReservationEntity | null>;
    items(ctx: RequestContext, reservationId: number): Promise<StockReservationItemEntity[]>;
    /** 下单预占：建头单 PENDING_ALLOC（幂等：同一 orderLine+variant 复用）。虚拟 allocation 由 core 下单流程完成，此处仅记账。 */
    reserveOnOrder(ctx: RequestContext, orderId: ID, orderLineId: ID, variantId: ID, totalQty: number): Promise<StockReservationEntity>;
    /** 备货拆分：重建 item（幂等），守恒校验 Σqty==totalQty、每仓 qty≤物理 onHand，头→ALLOCATED */
    allocate(ctx: RequestContext, reservationId: number, splits: ReservationSplit[]): Promise<StockReservationEntity>;
    /** 出库核销：按核销数量递减 item.qty，清零→DONE；全部 DONE→头 DONE。物理扣减由 core 在 SALE 完成。 */
    fulfill(ctx: RequestContext, reservationId: number, itemId: number, quantity?: number): Promise<StockReservationItemEntity>;
    /** 取消/退款：对称释放。returnPhysical=true 时对已出库 DONE 明细回补物理仓（默认 false，core 的 CANCELLATION/RELEASE 已回补）。 */
    release(ctx: RequestContext, reservationId: number, options?: {
        returnPhysical?: boolean;
    }): Promise<StockReservationEntity>;
    /** 对账恒等式：Σ物理 − 虚拟 == ΣPENDING item qty（按变体，渠道内） */
    reconcileScan(ctx: RequestContext): Promise<Array<{
        variantId: number;
        physicalSum: number;
        virtualSum: number;
        pendingQty: number;
        diff: number;
    }>>;
    registerOrderHandlers(): void;
    /** ALLOCATION=下单预占：按 orderLine 聚合成头单 + 逐仓拆分（配送方式决定 fulfillType） */
    private onAllocation;
    /** SALE=发货/自提核销：按 orderLine+location 命中预留明细并核销（物理扣减 core 已完成，仅记账） */
    private onSale;
    /** CANCELLATION/RELEASE=取消/退款：头单对称释放 */
    private onRelease;
}
