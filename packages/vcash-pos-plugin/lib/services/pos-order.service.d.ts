import { ID, Order, OrderService, RequestContext, StockMovementService, TransactionalConnection } from '@vendure/core';
import { Connection } from 'typeorm';
import { PosSession } from '../entities/pos-session.entity';
import { MemberPriceCalculator } from './member-price-calculator';
import { PromotionEngineService } from './promotion-engine.service';
export interface CreateOrderFromOfflineInput {
    terminalCode: string;
    orderType: string;
    lines: Array<{
        productVariantId: ID;
        quantity: number;
        discount?: number;
        isGift?: boolean;
        note?: string;
        originalPrice?: number;
    }>;
    payments: Array<{
        method: string;
        transactionId?: string;
        metadata?: any;
    }>;
}
/**
 * POS 收银核心服务：
 * - ensureActiveOrder: 班次内有活跃 Order 则复用，否则创建新 Order 并绑定 custom fields
 * - addPosItem: 加商品到 Order，通过 addItemToOrder 第 5 参设置 OrderLine custom fields
 * - updatePosItem: 修改 OrderLine 数量
 * - checkoutPosOrder: transitionToState ArrangingPayment → addManualPaymentToOrder → transitionToState PaymentSettled
 *
 * 关键 API 约束（Vendure 3.6.4 实际签名，已通过 Grep 验证）：
 * 1. OrderService.create(ctx, userId?) 不接受 stockLocationCode/customFields
 * 2. addItemToOrder(ctx, orderId, variantId, qty, customFields?) 第 5 参设 OrderLine 字段
 * 3. addManualPaymentToOrder 必须在事务中；method 字段不校验 PaymentMethod 注册
 * 4. PaymentSettled 需手动 transitionToState；checkPaymentsCoverTotal 默认校验
 */
export declare class PosOrderService {
    private connection;
    private transactionalConnection;
    private orderService;
    private stockMovementService;
    private memberPriceCalculator;
    private promotionEngine;
    constructor(connection: Connection, transactionalConnection: TransactionalConnection, orderService: OrderService, stockMovementService: StockMovementService, memberPriceCalculator: MemberPriceCalculator, promotionEngine: PromotionEngineService);
    /**
     * 确保班次有活跃 Order。无则创建并绑定 custom fields + session.customer。
     */
    ensureActiveOrder(ctx: RequestContext, session: PosSession): Promise<Order>;
    /**
     * 加商品到当前班次 Order。通过 addItemToOrder 第 5 参设置 OrderLine custom fields。
     * 若 session 绑定会员且匹配会员价规则：自动应用 discountPercent（未显式传 discount 时）。
     * 会员价实际生效：更新 OrderLine.listPrice = Math.floor(originalListPrice * discountPercent / 100)
     */
    addPosItem(ctx: RequestContext, session: PosSession, input: {
        productVariantId: ID;
        quantity: number;
        discount?: number;
        isGift?: boolean;
        note?: string;
        originalPrice?: number;
    }): Promise<Order>;
    /**
     * 修改 OrderLine 数量。
     */
    updatePosItem(ctx: RequestContext, session: PosSession, input: {
        orderLineId: ID;
        quantity: number;
    }): Promise<Order>;
    /**
     * 结账：transitionToState ArrangingPayment → addManualPaymentToOrder → transitionToState PaymentSettled。
     * addManualPaymentToOrder 必须在事务中，整个结账流程用 withTransaction 包裹。
     */
    checkoutPosOrder(ctx: RequestContext, session: PosSession, input: {
        payments: Array<{
            method: string;
            transactionId?: string;
            metadata?: any;
        }>;
    }): Promise<{
        order: Order;
        payments: any[];
    }>;
    /**
     * 离线订单同步入口：创建 Draft Order → 加商品 → 结账。
     * 不依赖 PosSession（离线订单可能没有对应的服务端班次），直接创建独立 Order。
     * 库存不足（addItemToOrder 抛 Insufficient stock）→ 抛 code='OUT_OF_STOCK' 错误。
     */
    createOrderFromOffline(ctx: RequestContext, order: CreateOrderFromOfflineInput): Promise<Order>;
    /**
     * 创建退货单：独立 orderType=refund 的 Order + 负数量 OrderLine 直插 + createCancellationsForOrderLines 回库。
     *
     * 关键约束：
     * 1. addItemToOrder 不接受负数量，需通过 OrderLine Repository 直插
     * 2. addManualPaymentToOrder 自动计算 amount = totalWithTax - totalCoveredBy，退货 total 为负 → Payment 负金额
     * 3. createCancellationsForOrderLines 不校验 orderLine.quantity 正负，基于 input.quantity(正数) 回库
     * 4. 原单必须 PaymentSettled，退货数量不超过原单已售数量（已退货数量需查关联 refund 单累加）
     */
    createRefundOrder(ctx: RequestContext, session: PosSession, input: {
        originalOrderId: ID;
        refundLines: Array<{
            orderLineId: ID;
            quantity: number;
            reason?: string;
        }>;
    }): Promise<{
        refundOrder: Order;
        originalOrder: Order;
    }>;
    /**
     * 查询某原单已累计被退货的数量（按 originalOrderLineId 聚合）。
     * 通过 refundedOrderId custom field 反查所有 refund 单及其 OrderLine，
     * 再用 OrderLine custom field originalOrderLineId 精确匹配原单行。
     */
    private getAlreadyRefundedQuantities;
    /**
     * 挂单: 把当前活跃 Order 的 orderType 改为 hold，清空 session.activeOrderId。
     * 挂单后该 Order 仍为 Draft（active=true），可在挂单列表中按 orderType=hold 过滤显示。
     */
    holdOrder(ctx: RequestContext, session: PosSession): Promise<Order>;
    /**
     * 取单: 校验目标 Order 为 hold 状态 + 归属本终端 + 当前无活跃订单，
     * 然后把 orderType 改回 sale 并设为 session.activeOrderId。
     */
    resumeOrder(ctx: RequestContext, session: PosSession, orderId: ID): Promise<Order>;
    /**
     * 挂单列表: 当前 session.terminal 下所有 orderType=hold 的 Draft Order。
     * 按 updatedAt 倒序。
     */
    findHeldOrders(ctx: RequestContext, session: PosSession): Promise<Order[]>;
    /**
     * 按订单号查询原单（退货场景入口）。
     * 用 Vendure OrderService.findAll + filter code 精确匹配，返回带 lines/payments 的完整 Order。
     */
    findByCode(ctx: RequestContext, code: string): Promise<Order | null>;
}
