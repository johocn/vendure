import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { Not } from 'typeorm';
import {
    ID,
    Injector,
    isGraphQlErrorResult,
    ListQueryBuilder,
    ListQueryOptions,
    OrderService,
    CustomerService,
    AssetService,
    Administrator,
    Channel,
    ChannelService,
    ConfigService,
    PaginatedList,
    RequestContext,
    Logger,
    TransactionalConnection,
    EntityNotFoundError,
    EventBus,
    UserInputError,
    ForbiddenError,
    UnauthorizedError,
} from '@vendure/core';

import { loggerCtx, AFTER_SALES_PLUGIN_OPTIONS } from './constants';
import { AfterSalesRequest } from './after-sales-request.entity';
import { AfterSalesMessage, AfterSalesMessageSenderType } from './after-sales-message.entity';
import { AfterSalesStateHistory } from './after-sales-state-history.entity';
import { AfterSalesStateTransitionEvent } from './after-sales.events';
import { AfterSalesState, AfterSalesPluginOptions, STATE_TRANSITIONS } from './types';
import { InventoryService } from '@vendure/inventory-plugin';

@Injectable()
export class AfterSalesService {
    private orderService: OrderService | null = null;
    private customerService: CustomerService | null = null;
    private inventoryService: InventoryService | null = null;
    private options: AfterSalesPluginOptions = {};
    private assetService: AssetService | null = null;
    private configService: ConfigService | null = null;
    private channelService: ChannelService | null = null;
    private eventBus: EventBus | null = null;

    constructor(
        private connection: TransactionalConnection,
        private listQueryBuilder: ListQueryBuilder,
    ) {}

    init(injector: Injector): void {
        this.orderService = injector.get(OrderService);
        this.customerService = injector.get(CustomerService);
        try {
            this.inventoryService = injector.get(InventoryService);
        } catch (e: any) {
            this.inventoryService = null;
            Logger.warn(`InventoryService 不可用，售后回补库存被禁用: ${e?.message ?? e}`, loggerCtx);
        }
        try {
            this.options = injector.get<AfterSalesPluginOptions>(AFTER_SALES_PLUGIN_OPTIONS as any) ?? {};
        } catch {
            this.options = {};
        }
        this.assetService = injector.get(AssetService);
        this.configService = injector.get(ConfigService);
        try {
            this.channelService = injector.get(ChannelService);
        } catch {
            this.channelService = null;
        }
        try {
            this.eventBus = injector.get(EventBus);
        } catch {
            this.eventBus = null;
        }
    }

    /**
     * 当前登录用户对应的 Customer 主键。
     * 说明：ctx.activeUserId 是 User 表主键，而售后单 customerId 存的是 Customer 表主键，
     * 两者是不同实体，必须经 CustomerService.findOneByUserId 桥接，否则过滤永远匹配不到。
     */
    private async resolveCustomerId(ctx: RequestContext): Promise<number | null> {
        if (!ctx.activeUserId || !this.customerService) return null;
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        return customer ? Number(customer.id) : null;
    }

    async findOne(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id as any },
            relations: { order: true, orderLine: true, customer: true, channels: true, history: true },
            order: { history: { createdAt: 'ASC' } } as any,
        });
        return result ?? undefined;
    }

    /**
     * Shop API 专用：按 customer 过滤，防止越权枚举他人售后单。
     */
    async findOneForCustomer(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined> {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            throw new UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id as any, customerId },
            relations: { order: true, orderLine: true, channels: true, history: true },
            order: { history: { createdAt: 'ASC' } } as any,
        });
        if (result) {
            await this.attachMessageCounts(ctx, [result]);
        }
        return result ?? undefined;
    }

    async findMyRequests(
        ctx: RequestContext,
        options?: ListQueryOptions<AfterSalesRequest>,
    ): Promise<PaginatedList<AfterSalesRequest>> {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) {
            return { items: [], totalItems: 0 };
        }
        return this.listQueryBuilder
            .build(AfterSalesRequest, options, {
                ctx,
                relations: ['order', 'orderLine', 'channels'],
                channelId: ctx.channelId,
            })
            .andWhere('aftersalesrequest."customerId" = :customerId', { customerId })
            .getManyAndCount()
            .then(async ([items, totalItems]) => {
                await this.attachMessageCounts(ctx, items);
                return { items, totalItems };
            });
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<AfterSalesRequest>,
    ): Promise<PaginatedList<AfterSalesRequest>> {
        return this.listQueryBuilder
            .build(AfterSalesRequest, options, {
                ctx,
                relations: ['order', 'orderLine', 'customer', 'channels'],
                channelId: ctx.channelId,
            })
            .getManyAndCount()
            .then(async ([items, totalItems]) => {
                await this.attachMessageCounts(ctx, items);
                return { items, totalItems };
            });
    }

    async createRequest(ctx: RequestContext, input: {
        orderId: ID;
        orderLineId?: ID;
        type: string;
        reason: string;
        description?: string;
        evidenceImages?: string[];
        refundAmount: number;
    }): Promise<AfterSalesRequest> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }

        // 1. 校验订单存在且归属当前用户。
        // 注意：order.customer.id 是 Customer 主键，而 ctx.activeUserId 是关联 User 主键，两者不同。
        // 归属校验必须基于 customer.user.id 与 activeUserId 比较。
        let order;
        try {
            order = await this.orderService.findOne(ctx, input.orderId, ['customer', 'customer.user', 'lines'] as any);
        } catch (e: any) {
            throw e;
        }
        if (!order) {
            throw new UserInputError(`Order ${input.orderId} not found`);
        }
        const customerUserId = (order.customer as any)?.user?.id;
        if (!order.customer || customerUserId == null || String(customerUserId) !== String(ctx.activeUserId)) {
            throw new ForbiddenError();
        }

        // 2. 校验订单状态（白名单可配置；外卖单全程 PaymentSettled，由 dev-config 显式放行）
        const allowedStates = this.options?.allowedOrderStates?.length
            ? this.options.allowedOrderStates
            : ['Shipped', 'Delivered', 'PartiallyDelivered', 'Completed', 'Cancelled'];
        if (!allowedStates.includes(order.state)) {
            throw new UserInputError(
                `Cannot create after-sales: order state must be one of ${allowedStates.join('/')}, got ${order.state}`,
            );
        }

        // 3. 售后窗口校验：
        //    afterSalesWindowHours > 0 时按小时窗口（送达时间起算，外卖 24h 场景）；
        //    否则按 maxDays + 15 天质量问题延长逻辑。
        //    计时起点 fulfillmentCompletedAt → fulfillmentDeliveredAt → deliveredAt（外卖骑手送达落库）→ updatedAt。
        const cf: Record<string, any> = (order.customFields ?? {}) as any;
        const orderDate: Date = cf.fulfillmentCompletedAt || cf.fulfillmentDeliveredAt || cf.deliveredAt
            || order.updatedAt || order.createdAt;
        const windowHours = this.options?.afterSalesWindowHours ?? 0;
        if (windowHours > 0) {
            const hoursSince = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60);
            if (hoursSince > windowHours) {
                throw new UserInputError(`Cannot create after-sales: exceeded ${windowHours}h window`);
            }
        } else {
            const maxDays = this.options?.maxDaysAfterDelivery ?? 7;
            const daysSince = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > maxDays + 15) {
                throw new UserInputError(`Cannot create after-sales: exceeded ${maxDays + 15} days limit`);
            }
        }

        // 3.1 送达门槛（外卖场景）：requireOrderCustomField 指定的 customFields 字段必须等于指定值，
        //     防止未送达（deliveryStatus 空/assigned/in_progress）的已支付单走售后与取消链路双退款
        const gate = this.options?.requireOrderCustomField;
        if (gate?.field) {
            const actual = cf[gate.field];
            if (String(actual) !== String(gate.value)) {
                throw new UserInputError(
                    `Cannot create after-sales: order not eligible (${gate.field}=${actual ?? 'null'})`,
                );
            }
        }

        // 4. 退款金额上限校验
        const orderLine = input.orderLineId
            ? order.lines.find(l => String(l.id) === String(input.orderLineId))
            : null;
        if (input.orderLineId && !orderLine) {
            throw new UserInputError(`Order line ${input.orderLineId} not found in order ${input.orderId}`);
        }
        const maxRefund = orderLine
            ? orderLine.proratedLinePrice
            : (order.totalQuantity > 0 ? order.total : 0);
        if (input.refundAmount > maxRefund) {
            throw new UserInputError(`Refund amount ${input.refundAmount} exceeds max ${maxRefund}`);
        }

        // 4.1 用解码后的实体 ID 存储外键：order.id / line.id 已是数据库内部数字 ID，
        // 不能直接用 GraphQL 编码 ID（T_1）写入 number 外键列，否则触发 FOREIGN KEY 约束失败。
        const entityOrderId = order.id;
        const entityOrderLineId = orderLine ? orderLine.id : null;

        // 5. 重复售后校验：整单售后（无 orderLineId）按订单查重；指定行按行查重（均排除 Closed，
        //    Rejected 也算占用——被拒单必须走申诉，不允许绕开仲裁重新提单）
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        if (entityOrderLineId != null) {
            const existing = await repo.findOne({
                where: { orderLineId: entityOrderLineId as any, state: Not('Closed' as any) },
            });
            if (existing) {
                throw new UserInputError(`After-sales already exists for order line ${input.orderLineId}`);
            }
        } else {
            const existing = await repo.findOne({
                where: { orderId: entityOrderId as any, state: Not('Closed' as any) },
            });
            if (existing) {
                throw new UserInputError(`After-sales already exists for order ${input.orderId}`);
            }
        }
        const request = new AfterSalesRequest({
            orderId: entityOrderId as any,
            orderLineId: entityOrderLineId as any,
            type: (input.type as any) || 'return_refund',
            reason: input.reason,
            description: input.description || null,
            evidenceImages: input.evidenceImages || null,
            refundAmount: input.refundAmount,
            customerId: (order.customer as any).id as any,
        });
        request.channels = [ctx.channel];
        const saved = await this.commitState(ctx, request, null, 'Pending');
        Logger.info(`After-sales request ${saved.id} created by customer ${ctx.activeUserId}`, loggerCtx);
        return this.hydrate(ctx, saved.id);
    }

    async cancelRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        if (request.state !== 'Pending') {
            throw new Error(`Cannot cancel request in state: ${request.state}`);
        }
        const fromState = request.state;
        const saved = await this.commitState(ctx, request, fromState, 'Closed');
        return this.hydrate(ctx, saved.id);
    }

    async updateReturnTracking(ctx: RequestContext, id: ID, trackingNo: string, carrier: string): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        if (request.state !== 'Approved') {
            throw new Error(`Cannot update tracking in state: ${request.state}`);
        }
        const fromState = request.state;
        request.returnTrackingNo = trackingNo;
        request.returnCarrier = carrier;
        const saved = await this.commitState(ctx, request, fromState, 'Returning');
        return this.hydrate(ctx, saved.id);
    }

    /** 凭证图白名单 MIME 及其扩展名（扩展名用于 createFromFileStream 判定 MIME） */
    private static readonly EVIDENCE_MIME_EXT: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
    };

    /** 单张凭证图解码后大小上限（5MB），边界校验，非业务规则 */
    private static readonly EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

    /**
     * 顾客端上传售后凭证图。
     * 仅做「边界校验 + 落 Asset」，不创建售后单、不写售后业务数据。
     * 返回绝对值 URL：AssetInterceptorPlugin 只对 GraphQL 类型为 Asset 的字段补绝对前缀，
     * 这里是 [String!]!，必须自行调用 storageStrategy.toAbsoluteUrl（与 Vendure 自身行为一致）。
     */
    async uploadEvidence(ctx: RequestContext, images: string[]): Promise<string[]> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        if (!Array.isArray(images) || images.length === 0) {
            throw new UserInputError('No evidence image provided');
        }
        if (!this.assetService || !this.configService) {
            throw new Error('AssetService not initialized');
        }
        const urls: string[] = [];
        for (const dataUrl of images) {
            const parsed = AfterSalesService.parseImageDataUrl(dataUrl);
            if (!parsed) {
                throw new UserInputError('Invalid evidence image: only png/jpeg/webp data URL is allowed');
            }
            if (parsed.buffer.length > AfterSalesService.EVIDENCE_MAX_BYTES) {
                throw new UserInputError(
                    `Evidence image too large: ${parsed.buffer.length} bytes exceeds ${AfterSalesService.EVIDENCE_MAX_BYTES} bytes`,
                );
            }
            const filename = `after-sales-evidence-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${parsed.ext}`;
            const asset = await this.assetService.createFromFileStream(Readable.from(parsed.buffer), filename, ctx);
            if (isGraphQlErrorResult(asset)) {
                throw new UserInputError(`Failed to create asset: ${asset.message}`);
            }
            urls.push(this.toAbsoluteAssetUrl(ctx, (asset as any).preview));
        }
        Logger.info(`Uploaded ${urls.length} after-sales evidence image(s) by user ${ctx.activeUserId}`, loggerCtx);
        return urls;
    }

    /** 解析 `data:image/(png|jpeg|webp);base64,xxx`，非法返回 null */
    private static parseImageDataUrl(dataUrl: string): { buffer: Buffer; ext: string } | null {
        if (typeof dataUrl !== 'string') return null;
        const match = /^data:(image\/[a-z+.-]+);base64,([\s\S]+)$/i.exec(dataUrl.trim());
        if (!match) return null;
        const mime = match[1].toLowerCase();
        const ext = AfterSalesService.EVIDENCE_MIME_EXT[mime];
        if (!ext) return null;
        try {
            const buffer = Buffer.from(match[2], 'base64');
            if (buffer.length === 0) return null;
            return { buffer, ext };
        } catch {
            return null;
        }
    }

    /** 与 AssetInterceptorPlugin 同源：用 assetStorageStrategy.toAbsoluteUrl 补绝对前缀 */
    private toAbsoluteAssetUrl(ctx: RequestContext, preview: string | null | undefined): string {
        if (!preview) return '';
        const strategy = this.configService?.assetOptions.assetStorageStrategy as any;
        if (strategy?.toAbsoluteUrl && ctx.req) {
            return strategy.toAbsoluteUrl(ctx.req, preview);
        }
        return preview;
    }

    /**
     * Mutation 保存后重新加载并返回带关系（order/orderLine）的实体。
     * 直接 repo.save() 返回的实体关系未加载，Shop SDL 中 `order: Order!` 非空字段会被自动关系解析取到 null，
     * 触发 "Cannot return null for non-nullable field AfterSalesRequest.order"。
     */
    private async hydrate(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const full = await repo.findOne({
            where: { id: id as any },
            relations: { order: true, orderLine: true, channels: true, history: true },
            order: { history: { createdAt: 'ASC' } } as any,
        });
        if (full) {
            await this.attachMessageCounts(ctx, [full]);
            return full;
        }
        throw new Error(`AfterSalesRequest #${id} not found after save`);
    }

    /**
     * 状态变更统一出口：写状态 + 落历史 + 发布 AfterSalesStateTransitionEvent。
     * 所有状态写入点必须经此方法保证通知全覆盖；事件发布失败仅告警不阻断。
     */
    private async commitState(
        ctx: RequestContext,
        request: AfterSalesRequest,
        fromState: string | null,
        toState: AfterSalesState,
    ): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        request.state = toState;
        const saved = await repo.save(request);
        await this.recordState(ctx, Number(saved.id), fromState, toState);
        try {
            const full = await repo.findOne({ where: { id: saved.id as any }, relations: { order: true } });
            await this.eventBus?.publish(
                new AfterSalesStateTransitionEvent(
                    ctx,
                    Number(saved.id),
                    Number(saved.orderId),
                    saved.type,
                    fromState,
                    toState,
                    saved.customerId != null ? Number(saved.customerId) : null,
                    full?.order?.code ?? null,
                    new Date(),
                ),
            );
        } catch (e: any) {
            Logger.warn(`publish AfterSalesStateTransitionEvent failed for #${saved.id}: ${e?.message ?? e}`, loggerCtx);
        }
        return saved;
    }

    /** 状态流转历史落库：失败仅告警，绝不阻断主流程 */
    private async recordState(ctx: RequestContext, requestId: number, fromState: string | null, toState: string): Promise<void> {
        try {
            const repo = this.connection.getRepository(ctx, AfterSalesStateHistory);
            await repo.insert({
                requestId,
                fromState: fromState ?? null,
                toState,
                operatorUserId: ctx.activeUserId != null ? Number(ctx.activeUserId) : null,
            });
        } catch (e: any) {
            Logger.warn(`recordState failed for after-sales #${requestId}: ${e?.message ?? e}`, loggerCtx);
        }
    }

    // ===== Admin Operations =====

    async approveRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        const saved = await this.transitionState(ctx, id, 'Approved');
        // refund_only（外卖）无需退货：审批通过（含 48h 自动同意）即链式 Received → 退款
        if ((request.type as string) === 'refund_only') {
            return this.refundOnlyChain(ctx, id);
        }
        return saved;
    }

    /** refund_only 退款链：Approved → Received（免退货直达）→ executeRefund。
     *  退款失败由 executeRefund 内部落 RefundFailed 可重试，不回滚已到达的 Received。 */
    private async refundOnlyChain(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        await this.transitionState(ctx, id, 'Received');
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({
            where: { id: id as any },
            relations: ['order', 'order.payments'] as any,
        });
        if (!request) throw new EntityNotFoundError('AfterSalesRequest', id);
        return this.executeRefund(ctx, request);
    }

    async rejectRequest(ctx: RequestContext, id: ID, reason: string): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        if (!STATE_TRANSITIONS[request.state]?.includes('Rejected')) {
            throw new Error(`Cannot reject from state: ${request.state}`);
        }
        const fromState = request.state;
        request.rejectReason = reason;
        const saved = await this.commitState(ctx, request, fromState, 'Rejected');
        return this.hydrate(ctx, saved.id);
    }

    /** C 端申诉：Rejected → Appealed（仅本人售后单）；申诉说明落入协商留言流（customer），商家/平台可见 */
    async appealRequest(ctx: RequestContext, id: ID, note: string): Promise<AfterSalesRequest> {
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId) throw new UnauthorizedError();
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any, customerId } });
        if (!request) throw new UserInputError(`After-sales request ${id} not found`);
        if (request.state !== 'Rejected') {
            throw new UserInputError(`Cannot appeal request in state: ${request.state}`);
        }
        if (note?.trim()) {
            await this.addMessage(ctx, id, 'customer', note.trim().slice(0, 1000));
        }
        return this.transitionState(ctx, id, 'Appealed');
    }

    /** 平台仲裁：Appealed → Approved（同意；refund_only 链式退款）| Closed（维持拒绝，note 必填写入 rejectReason） */
    async arbitrateRequest(ctx: RequestContext, id: ID, approve: boolean, note?: string): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        if (request.state !== 'Appealed') {
            throw new Error(`Cannot arbitrate request in state: ${request.state}`);
        }
        if (!approve) {
            const text = (note ?? '').trim();
            if (!text) throw new UserInputError('维持拒绝必须填写仲裁说明');
            request.rejectReason = text;
            await repo.save(request);
            return this.transitionState(ctx, id, 'Closed');
        }
        if (note?.trim()) {
            // 仲裁说明落入协商留言流（admin 侧），C 端留言卡可见
            await this.addMessage(ctx, id, 'admin', note.trim().slice(0, 1000));
        }
        const saved = await this.transitionState(ctx, id, 'Approved');
        if ((request.type as string) === 'refund_only') {
            return this.refundOnlyChain(ctx, id);
        }
        return saved;
    }

    /**
     * Returning → Received（收到退货）：
     * 在状态流转前先做库存回补——把收到的退货回补到原发货仓（orderLine.stockLocationId），
     * 同一事务内写 afterSales 账本，避免“退款了但库存不回来”。回补失败不影响收退货流程（告警）。
     * @param receivedQuantity 实收数量（部分退货按实收回补；缺省按订单行数量全额回补）
     */
    async confirmReceive(ctx: RequestContext, id: ID, receivedQuantity?: number): Promise<AfterSalesRequest> {
        return this.connection.withTransaction(ctx, async txCtx => {
            const repo = this.connection.getRepository(txCtx, AfterSalesRequest);
            const request = await repo.findOne({
                where: { id: id as any },
                relations: ['orderLine'],
            });
            if (!request) throw new Error('Request not found');
            const allowed = STATE_TRANSITIONS[request.state];
            if (!allowed?.includes('Received')) {
                throw new Error(`Invalid transition: ${request.state} -> Received`);
            }

            // 实收数量：显式传入则记录；否则缺省为订单行数量（全额回补）
            const orderLine = request.orderLine;
            const orderedQty = orderLine ? Number(orderLine.quantity) || 0 : 0;
            if (receivedQuantity != null) {
                request.receivedQuantity = Math.max(0, Math.floor(receivedQuantity));
            }
            const recoverQty = Math.max(
                0,
                Math.min(
                    orderedQty,
                    request.receivedQuantity != null ? request.receivedQuantity : orderedQty,
                ),
            );

            // 库存回补：按各仓实际发货比例多仓按包回补（单仓退化原逻辑），落 restockJson 留痕
            if (orderLine && this.inventoryService && recoverQty > 0) {
                try {
                    const restockDetail = await this.inventoryService.applyAfterSalesRestockMulti(
                        txCtx,
                        (orderLine.id as any) as ID,
                        recoverQty,
                        `AS${request.id}`,
                    );
                    request.restockJson = restockDetail.length ? JSON.stringify(restockDetail) : null;
                    Logger.info(
                        `库存回补 after-sales#${request.id}: ${JSON.stringify(restockDetail)}`,
                        loggerCtx,
                    );
                } catch (e: any) {
                    // 回补失败不阻断收退货流程（仍可退款），仅告警便于运维追查
                    Logger.error(
                        `库存回补失败 after-sales#${request.id}: ${e?.message ?? e}`,
                        loggerCtx,
                    );
                }
            } else if (recoverQty === 0) {
                Logger.warn(`after-sales#${request.id} recoverQty=0，跳过库存回补`, loggerCtx);
            } else {
                Logger.warn(
                    `after-sales#${request.id} 无订单行或 InventoryService 不可用，跳过库存回补`,
                    loggerCtx,
                );
            }

            const fromState = request.state;
            const saved = await this.commitState(txCtx, request, fromState, 'Received');
            return this.hydrate(txCtx, saved.id);
        });
    }

    async processRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({
            where: { id: id as any },
            relations: ['order', 'order.payments'] as any,
        });
        if (!request) {
            throw new EntityNotFoundError('AfterSalesRequest', id);
        }
        if (request.state !== 'Received') {
            throw new UserInputError('Cannot refund: request must be in Received state');
        }
        if (request.type === 'exchange') {
            throw new UserInputError('Cannot refund: exchange requests are not refundable');
        }
        return this.executeRefund(ctx, request);
    }

    /**
     * 退款失败后重试：仅 RefundFailed 允许；复用 executeRefund 退款核心。
     */
    async retryRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        if (!this.orderService) {
            throw new Error('OrderService not initialized');
        }
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({
            where: { id: id as any },
            relations: ['order', 'order.payments'] as any,
        });
        if (!request) {
            throw new EntityNotFoundError('AfterSalesRequest', id);
        }
        if (request.state !== 'RefundFailed') {
            throw new UserInputError('Cannot retry refund: request must be in RefundFailed state');
        }
        return this.executeRefund(ctx, request);
    }

    /**
     * 退款核心：调用 orderService.refundOrder 创建原生 Refund；若支付处理器将 Refund 停在 Pending
     * （真实网关异步对账场景），则再调 settleRefund 推进到 Settled 终态。
     * 仅当 Refund 达 Settled 才把售后单置 Refunded 并落账；失败则置 RefundFailed（留 refundError，可重试）。
     * 杜绝"已标退款但钱从未退回"的假退款脏数据。
     */
    private async executeRefund(ctx: RequestContext, request: AfterSalesRequest): Promise<AfterSalesRequest> {
        const payments = (request.order as any)?.payments as Array<{ id: ID; amount: number }> | undefined;
        if (!payments || payments.length === 0) {
            throw new UserInputError(`Cannot refund: no payment found for order ${request.orderId}`);
        }
        const paymentId = payments[0].id;
        const fromState = request.state;

        // 事务包裹：退款成功后统一提交（改状态 + 落账 + 回写 order.afterSalesStatus），失败回滚整笔。
        await this.connection.startTransaction(ctx);
        try {
            const repo = this.connection.getRepository(ctx, AfterSalesRequest);
            const refundResult = await this.orderService!.refundOrder(ctx, {
                paymentId,
                amount: request.refundAmount,
                reason: `After-sales refund #${request.id}`,
                shipping: 0, // Refund.shipping 为 NOT NULL 列，必须显式置 0
                adjustment: 0,
            } as any);

            if (isGraphQlErrorResult(refundResult)) {
                // refundOrder 拒绝（如超额 RefundAmountError）：无实际退款发生，置 RefundFailed 留痕并提交
                request.refundError = `refundOrder 拒绝: ${JSON.stringify(refundResult)}`;
                request.refundedAt = undefined;
                await this.commitState(ctx, request, fromState, 'RefundFailed');
                await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'RefundFailed');
                await this.connection.commitOpenTransaction(ctx);
                Logger.warn(`after-sales #${request.id} refundOrder 拒绝: ${request.refundError}`, loggerCtx);
                return this.hydrate(ctx, request.id as any);
            }
            const refund = refundResult as any; // Vendure 原生 Refund

            // 若仍停在 Pending（异步对账/需手动落定场景），推进到 Settled 终态
            if (refund.state === 'Pending') {
                const settled = await this.orderService!.settleRefund(ctx, {
                    id: refund.id as ID,
                    transactionId: refund.transactionId ?? '',
                } as any);
                refund.state = settled.state;
            }

            if (refund.state === 'Settled') {
                request.refundTransactionId = refund.transactionId || null;
                request.actualRefundAmount = refund.total != null ? Number(refund.total) : request.refundAmount;
                request.refundError = null;
                request.refundedAt = new Date();
                await this.commitState(ctx, request, fromState, 'Refunded');
                await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'Refunded');
                Logger.info(`Refund settled for after-sales request #${request.id}, tx=${request.refundTransactionId}`, loggerCtx);
            } else {
                // Failed 等非成功终态：不抛（调用方可进入 RefundFailed 重试），仅告警与留痕
                request.refundError = `退款未达 Settled，当前 ${refund.state}`;
                request.refundedAt = undefined;
                await this.commitState(ctx, request, fromState, 'RefundFailed');
                await this.updateOrderAfterSalesStatus(ctx, request.orderId, 'RefundFailed');
                Logger.warn(`after-sales #${request.id} 退款终态 ${refund.state}，已置 RefundFailed`, loggerCtx);
            }

            await this.connection.commitOpenTransaction(ctx);
        } catch (e: any) {
            await this.connection.rollBackTransaction(ctx);
            if (e instanceof UserInputError && String(e.message).includes('refundOrder')) {
                // refundOrder 拒绝已留痕 RefundFailed，这里直接抛给调用方
                throw e;
            }
            Logger.error(`Refund failed for after-sales #${request.id}: ${e.message}`, loggerCtx);
            // 未知异常：置 RefundFailed 以便重试，而非让事务留下半成品
            await this.applyRefundFailed(ctx, request.id, e.message, false);
            throw e;
        }
        return this.hydrate(ctx, request.id as any);
    }

    /** 幂等地把售后单置为 RefundFailed（不入事务，供 catch 兜底），避免异常路径留下半成品脏数据 */
    private async applyRefundFailed(ctx: RequestContext, idOrRequest: ID | AfterSalesRequest, error: string, inTx: boolean): Promise<void> {
        try {
            const repo = this.connection.getRepository(ctx, AfterSalesRequest);
            const request =
                typeof idOrRequest === 'object' ? idOrRequest : await repo.findOne({ where: { id: idOrRequest as any } });
            if (!request || request.state === 'Refunded') return;
            const fromState = request.state;
            request.refundError = error;
            request.refundedAt = undefined;
            if (fromState !== 'RefundFailed') {
                await this.commitState(ctx, request, fromState, 'RefundFailed');
            } else {
                // 已是 RefundFailed 的重复兜底：只更新错误信息，不再发布事件（防重试风暴）
                await repo.save(request);
            }
            await this.updateOrderAfterSalesStatus(ctx, (request as any).orderId, 'RefundFailed');
        } catch (inner: any) {
            Logger.error(`applyRefundFailed 兜底写入失败: ${inner?.message ?? inner}`, loggerCtx);
        }
    }

    /**
     * 回写 Order customFields.afterSalesStatus。失败仅告警，不影响主流程。
     */
    private async updateOrderAfterSalesStatus(ctx: RequestContext, orderId: ID, status: string): Promise<void> {
        if (!this.orderService) return;
        try {
            await this.orderService.updateCustomFields(ctx, orderId, { afterSalesStatus: status });
        } catch (e: any) {
            Logger.warn(`Failed to update order afterSalesStatus: ${e.message}`, loggerCtx);
        }
    }

    /** Admin 单查：加载 order/orderLine/customer/history（web-admin 详情页专用，替代列表过滤 hack） */
    async findOneForAdmin(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const result = await repo.findOne({
            where: { id: id as any },
            relations: { order: true, orderLine: true, customer: true, channels: true, history: true },
            order: { history: { createdAt: 'ASC' } } as any,
        });
        if (result) {
            await this.attachMessageCounts(ctx, [result]);
        }
        return result ?? undefined;
    }

    /** 批量同意：复用单条方法逐条执行，单条失败不中断整批。上限 50。 */
    async batchApprove(ctx: RequestContext, ids: ID[]): Promise<Array<{ id: string; success: boolean; state: string; message: string }>> {
        if (!Array.isArray(ids) || ids.length === 0) throw new UserInputError('ids is required');
        if (ids.length > 50) throw new UserInputError(`Batch limit is 50, got ${ids.length}`);
        const results: Array<{ id: string; success: boolean; state: string; message: string }> = [];
        for (const id of ids) {
            try {
                const r = await this.approveRequest(ctx, id);
                results.push({ id: String(id), success: true, state: r.state, message: '' });
            } catch (e: any) {
                results.push({ id: String(id), success: false, state: '', message: e?.message ?? String(e) });
            }
        }
        return results;
    }

    /** 批量拒绝：同 batchApprove，整批共用一个 reason。 */
    async batchReject(ctx: RequestContext, ids: ID[], reason: string): Promise<Array<{ id: string; success: boolean; state: string; message: string }>> {
        if (!Array.isArray(ids) || ids.length === 0) throw new UserInputError('ids is required');
        if (ids.length > 50) throw new UserInputError(`Batch limit is 50, got ${ids.length}`);
        const results: Array<{ id: string; success: boolean; state: string; message: string }> = [];
        for (const id of ids) {
            try {
                const r = await this.rejectRequest(ctx, id, reason);
                results.push({ id: String(id), success: true, state: r.state, message: '' });
            } catch (e: any) {
                results.push({ id: String(id), success: false, state: '', message: e?.message ?? String(e) });
            }
        }
        return results;
    }

    /** 读当前渠道售后寄回地址（Admin/Shop 共用；未配置返回空串） */
    async getReturnAddress(ctx: RequestContext): Promise<string> {
        const repo = this.connection.getRepository(ctx, Channel);
        const channel = await repo.findOne({ where: { id: ctx.channelId as any } });
        return (channel?.customFields as any)?.afterSalesReturnAddress ?? '';
    }

    /** 写当前渠道售后寄回地址（走 ChannelService.update，免开 ChannelService 权限） */
    async updateReturnAddress(ctx: RequestContext, address: string): Promise<boolean> {
        if (!this.channelService) throw new Error('ChannelService not initialized');
        await this.channelService.update(ctx, {
            id: ctx.channelId as any,
            customFields: { afterSalesReturnAddress: address },
        } as any);
        return true;
    }

    /**
     * 售后数据看板聚合（三期设计 §四）：窗口申请总数 / 仍 Pending / 实退总额 / 平均处理时长 / 按日 / 按状态 / 按类型。
     * from/to 接受 'YYYY-MM-DD' 或完整 ISO 串（纯日期的 to 按当日 23:59:59.999 收口）。
     * 分日聚合用 SUBSTR(createdAt,1,10)（sqlite/mysql 均支持）；平均处理时长用 JS 计算避免跨库 AVG 精度差异。
     */
    async stats(ctx: RequestContext, from: string, to: string): Promise<any> {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new UserInputError('Invalid from/to date');
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(to).trim())) {
            toDate.setHours(23, 59, 59, 999);
        }
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);

        const totalRequests = await repo
            .createQueryBuilder('r')
            .where('r.createdAt >= :from', { from: fromDate })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .getCount();

        const pendingCount = await repo
            .createQueryBuilder('r')
            .where('r.state = :state', { state: 'Pending' })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .getCount();

        const refundRow = await repo
            .createQueryBuilder('r')
            .select('COALESCE(SUM(r.actualRefundAmount), 0)', 'total')
            .where("r.state = 'Refunded'")
            .andWhere('r.refundedAt >= :from', { from: fromDate })
            .andWhere('r.refundedAt <= :to', { to: toDate })
            .getRawOne();
        const totalRefundAmount = Number(refundRow?.total ?? 0);

        const dailyRows = await repo
            .createQueryBuilder('r')
            .select('SUBSTR(r.createdAt, 1, 10)', 'date')
            .addSelect('COUNT(*)', 'total')
            .where('r.createdAt >= :from', { from: fromDate })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .groupBy('SUBSTR(r.createdAt, 1, 10)')
            .orderBy('SUBSTR(r.createdAt, 1, 10)', 'ASC')
            .getRawMany();

        const stateRows = await repo
            .createQueryBuilder('r')
            .select('r.state', 'key')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(r.actualRefundAmount), 0)', 'amount')
            .where('r.createdAt >= :from', { from: fromDate })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .groupBy('r.state')
            .getRawMany();

        const typeRows = await repo
            .createQueryBuilder('r')
            .select('r.type', 'key')
            .addSelect('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(r.actualRefundAmount), 0)', 'amount')
            .where('r.createdAt >= :from', { from: fromDate })
            .andWhere('r.createdAt <= :to', { to: toDate })
            .groupBy('r.type')
            .getRawMany();

        // 平均处理时长（小时）：窗口内 Refunded 行 refundedAt - createdAt 的均值，保留两位；无数据为 null
        const refunded = await repo.find({ where: { state: 'Refunded' as any } });
        const hours = refunded
            .filter(
                (r) =>
                    r.refundedAt &&
                    new Date(r.createdAt as any) >= fromDate &&
                    new Date(r.createdAt as any) <= toDate,
            )
            .map((r) => (r.refundedAt!.getTime() - new Date(r.createdAt as any).getTime()) / 3600000)
            .filter((h) => h >= 0);
        const avgHandleHours = hours.length
            ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 100) / 100
            : null;

        return {
            totalRequests,
            pendingCount,
            totalRefundAmount,
            avgHandleHours,
            daily: dailyRows.map((row: any) => ({ date: String(row.date), total: Number(row.total) })),
            byState: stateRows.map((row: any) => ({
                key: String(row.key),
                count: Number(row.count),
                amount: Number(row.amount),
            })),
            byType: typeRows.map((row: any) => ({
                key: String(row.key),
                count: Number(row.count),
                amount: Number(row.amount),
            })),
        };
    }

    private async transitionState(ctx: RequestContext, id: ID, toState: AfterSalesState): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new Error('Request not found');
        const allowed = STATE_TRANSITIONS[request.state];
        if (!allowed?.includes(toState)) {
            throw new Error(`Invalid transition: ${request.state} -> ${toState}`);
        }
        const saved = await this.commitState(ctx, request, request.state, toState);
        return this.hydrate(ctx, saved.id);
    }

    // ===== 协商留言（迭代三期） =====

    private static readonly MESSAGE_MAX_IMAGES = 3;
    private static readonly MESSAGE_MAX_LENGTH = 1000;

    /**
     * 追加一条协商留言。senderType=customer 供顾客发送（addAfterSalesMessage），admin 供商家回复（replyAfterSalesMessage）。
     * 售后单关闭（Closed）后禁止继续留言；图片 ≤3 张、正文 ≤1000 字。
     */
    async addMessage(
        ctx: RequestContext,
        requestId: ID,
        senderType: AfterSalesMessageSenderType,
        content: string,
        images?: string[] | null,
    ): Promise<AfterSalesMessage> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: requestId as any } });
        if (!request) throw new UserInputError(`After-sales request ${requestId} not found`);
        if (request.state === 'Closed') {
            // ForbiddenError 是 I18nError，自定义文案会被丢弃，故用 UserInputError 透传禁言提示
            throw new UserInputError('After-sales request is closed: messaging disabled');
        }
        const trimmed = (content ?? '').trim();
        if (!trimmed) {
            throw new UserInputError('Message content is required');
        }
        if (trimmed.length > AfterSalesService.MESSAGE_MAX_LENGTH) {
            throw new UserInputError(`Message content exceeds ${AfterSalesService.MESSAGE_MAX_LENGTH} characters`);
        }
        const imgs = Array.isArray(images) ? images : [];
        if (imgs.length > AfterSalesService.MESSAGE_MAX_IMAGES) {
            throw new UserInputError(`Message images exceed limit of ${AfterSalesService.MESSAGE_MAX_IMAGES}`);
        }
        const senderName = await this.resolveSenderName(ctx, senderType);
        const msgRepo = this.connection.getRepository(ctx, AfterSalesMessage);
        const message = await msgRepo.save(
            new AfterSalesMessage({
                requestId: Number(requestId),
                senderType,
                senderUserId: Number(ctx.activeUserId),
                senderName,
                content: trimmed,
                images: imgs.length ? imgs : null,
            }),
        );
        Logger.info(
            `After-sales message added: request=${requestId} sender=${senderType} user=${ctx.activeUserId}`,
            loggerCtx,
        );
        return message;
    }

    /** 发送人显示名：管理员取 Administrator、顾客取 Customer（姓名拼接），失败兜底 'user' */
    private async resolveSenderName(ctx: RequestContext, senderType: AfterSalesMessageSenderType): Promise<string> {
        if (!ctx.activeUserId) return 'user';
        try {
            if (senderType === 'admin') {
                const adminRepo = this.connection.getRepository(ctx, Administrator);
                const admin = await adminRepo.findOne({
                    where: { user: { id: ctx.activeUserId as any } } as any,
                    relations: { user: true },
                });
                if (admin) return `${admin.firstName} ${admin.lastName}`.trim();
            } else if (this.customerService) {
                const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
                if (customer) return `${customer.firstName} ${customer.lastName}`.trim();
            }
        } catch (e: any) {
            Logger.warn(`resolveSenderName failed: ${e?.message ?? e}`, loggerCtx);
        }
        return 'user';
    }

    /**
     * 售后单留言列表（createdAt 正序，skip/take 常规分页）。
     * senderType=customer 时校验售后单归属当前顾客，防止越权读他人留言。
     */
    async listMessages(
        ctx: RequestContext,
        requestId: ID,
        senderType: AfterSalesMessageSenderType,
        options?: { skip?: number; take?: number },
    ): Promise<PaginatedList<AfterSalesMessage>> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: requestId as any } });
        if (!request) throw new UserInputError(`After-sales request ${requestId} not found`);
        if (senderType === 'customer') {
            const customerId = await this.resolveCustomerId(ctx);
            if (!customerId || Number(request.customerId) !== customerId) {
                throw new ForbiddenError();
            }
        }
        const msgRepo = this.connection.getRepository(ctx, AfterSalesMessage);
        const take = Math.min(Math.max(options?.take ?? 50, 1), 100);
        const skip = Math.max(options?.skip ?? 0, 0);
        const [items, totalItems] = await msgRepo.findAndCount({
            where: { requestId: Number(requestId) },
            order: { createdAt: 'ASC' },
            skip,
            take,
        });
        return { items, totalItems };
    }

    /** 批量统计各售后单留言条数并附加到 messageCount 非持久化属性 */
    private async attachMessageCounts(ctx: RequestContext, requests: AfterSalesRequest[]): Promise<void> {
        if (!requests.length) return;
        const ids = requests.map((r) => Number(r.id));
        const msgRepo = this.connection.getRepository(ctx, AfterSalesMessage);
        const rows = await msgRepo
            .createQueryBuilder('m')
            .select('m.requestId', 'requestId')
            .addSelect('COUNT(*)', 'count')
            .where('m.requestId IN (:...ids)', { ids })
            .groupBy('m.requestId')
            .getRawMany<{ requestId: number; count: string }>();
        const map = new Map(rows.map((r) => [Number(r.requestId), Number(r.count)]));
        for (const r of requests) {
            r.messageCount = map.get(Number(r.id)) ?? 0;
        }
    }

    // ===== 换货闭环（迭代三期） =====

    /** 换货发货（admin）：Received → ExchangeShipped，仅 exchange 类型、仅 Received 状态可走 */
    async exchangeShip(ctx: RequestContext, id: ID, trackingNo: string, carrier: string): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new UserInputError(`After-sales request ${id} not found`);
        if (request.type !== 'exchange') {
            throw new UserInputError('Only exchange requests can be exchange-shipped');
        }
        if (request.state !== 'Received') {
            throw new UserInputError(`Cannot exchange-ship from state: ${request.state}`);
        }
        request.exchangeTrackingNo = trackingNo;
        request.exchangeCarrier = carrier;
        // commitState 统一出口：落历史 + 发布事件（顾客收「换货已发货」站内信）
        return this.commitState(ctx, request, 'Received', 'ExchangeShipped');
    }

    /** 换货确认收货（shop 顾客）：ExchangeShipped → Closed，需校验售后单归属 */
    async exchangeReceive(ctx: RequestContext, id: ID): Promise<AfterSalesRequest> {
        const repo = this.connection.getRepository(ctx, AfterSalesRequest);
        const request = await repo.findOne({ where: { id: id as any } });
        if (!request) throw new UserInputError(`After-sales request ${id} not found`);
        const customerId = await this.resolveCustomerId(ctx);
        if (!customerId || Number(request.customerId) !== customerId) {
            throw new ForbiddenError();
        }
        if (request.state !== 'ExchangeShipped') {
            throw new UserInputError(`Cannot exchange-receive from state: ${request.state}`);
        }
        // commitState 统一出口：fromState=ExchangeShipped 的 Closed 事件驱动「换货完成」站内信
        return this.commitState(ctx, request, 'ExchangeShipped', 'Closed');
    }
}
