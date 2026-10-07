import { ID, Injector, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { AfterSalesRequest } from './after-sales-request.entity';
import { AfterSalesMessage, AfterSalesMessageSenderType } from './after-sales-message.entity';
export declare class AfterSalesService {
    private connection;
    private listQueryBuilder;
    private orderService;
    private customerService;
    private inventoryService;
    private options;
    private assetService;
    private configService;
    private channelService;
    private eventBus;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    init(injector: Injector): void;
    /**
     * 当前登录用户对应的 Customer 主键。
     * 说明：ctx.activeUserId 是 User 表主键，而售后单 customerId 存的是 Customer 表主键，
     * 两者是不同实体，必须经 CustomerService.findOneByUserId 桥接，否则过滤永远匹配不到。
     */
    private resolveCustomerId;
    findOne(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined>;
    /**
     * Shop API 专用：按 customer 过滤，防止越权枚举他人售后单。
     */
    findOneForCustomer(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined>;
    findMyRequests(ctx: RequestContext, options?: ListQueryOptions<AfterSalesRequest>): Promise<PaginatedList<AfterSalesRequest>>;
    findAll(ctx: RequestContext, options?: ListQueryOptions<AfterSalesRequest>): Promise<PaginatedList<AfterSalesRequest>>;
    createRequest(ctx: RequestContext, input: {
        orderId: ID;
        orderLineId?: ID;
        type: string;
        reason: string;
        description?: string;
        evidenceImages?: string[];
        refundAmount: number;
    }): Promise<AfterSalesRequest>;
    cancelRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    updateReturnTracking(ctx: RequestContext, id: ID, trackingNo: string, carrier: string): Promise<AfterSalesRequest>;
    /** 凭证图白名单 MIME 及其扩展名（扩展名用于 createFromFileStream 判定 MIME） */
    private static readonly EVIDENCE_MIME_EXT;
    /** 单张凭证图解码后大小上限（5MB），边界校验，非业务规则 */
    private static readonly EVIDENCE_MAX_BYTES;
    /**
     * 顾客端上传售后凭证图。
     * 仅做「边界校验 + 落 Asset」，不创建售后单、不写售后业务数据。
     * 返回绝对值 URL：AssetInterceptorPlugin 只对 GraphQL 类型为 Asset 的字段补绝对前缀，
     * 这里是 [String!]!，必须自行调用 storageStrategy.toAbsoluteUrl（与 Vendure 自身行为一致）。
     */
    uploadEvidence(ctx: RequestContext, images: string[]): Promise<string[]>;
    /** 解析 `data:image/(png|jpeg|webp);base64,xxx`，非法返回 null */
    private static parseImageDataUrl;
    /** 与 AssetInterceptorPlugin 同源：用 assetStorageStrategy.toAbsoluteUrl 补绝对前缀 */
    private toAbsoluteAssetUrl;
    /**
     * Mutation 保存后重新加载并返回带关系（order/orderLine）的实体。
     * 直接 repo.save() 返回的实体关系未加载，Shop SDL 中 `order: Order!` 非空字段会被自动关系解析取到 null，
     * 触发 "Cannot return null for non-nullable field AfterSalesRequest.order"。
     */
    private hydrate;
    /**
     * 状态变更统一出口：写状态 + 落历史 + 发布 AfterSalesStateTransitionEvent。
     * 所有状态写入点必须经此方法保证通知全覆盖；事件发布失败仅告警不阻断。
     */
    private commitState;
    /** 状态流转历史落库：失败仅告警，绝不阻断主流程 */
    private recordState;
    approveRequest(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    /** refund_only 退款链：Approved → Received（免退货直达）→ executeRefund。
     *  退款失败由 executeRefund 内部落 RefundFailed 可重试，不回滚已到达的 Received。 */
    private refundOnlyChain;
    rejectRequest(ctx: RequestContext, id: ID, reason: string): Promise<AfterSalesRequest>;
    /** C 端申诉：Rejected → Appealed（仅本人售后单）；申诉说明落入协商留言流（customer），商家/平台可见 */
    appealRequest(ctx: RequestContext, id: ID, note: string): Promise<AfterSalesRequest>;
    /** 平台仲裁：Appealed → Approved（同意；refund_only 链式退款）| Closed（维持拒绝，note 必填写入 rejectReason） */
    arbitrateRequest(ctx: RequestContext, id: ID, approve: boolean, note?: string): Promise<AfterSalesRequest>;
    /**
     * Returning → Received（收到退货）：
     * 在状态流转前先做库存回补——把收到的退货回补到原发货仓（orderLine.stockLocationId），
     * 同一事务内写 afterSales 账本，避免“退款了但库存不回来”。回补失败不影响收退货流程（告警）。
     * @param receivedQuantity 实收数量（部分退货按实收回补；缺省按订单行数量全额回补）
     */
    confirmReceive(ctx: RequestContext, id: ID, receivedQuantity?: number): Promise<AfterSalesRequest>;
    processRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    /**
     * 退款失败后重试：仅 RefundFailed 允许；复用 executeRefund 退款核心。
     */
    retryRefund(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
    /**
     * 退款核心：调用 orderService.refundOrder 创建原生 Refund；若支付处理器将 Refund 停在 Pending
     * （真实网关异步对账场景），则再调 settleRefund 推进到 Settled 终态。
     * 仅当 Refund 达 Settled 才把售后单置 Refunded 并落账；失败则置 RefundFailed（留 refundError，可重试）。
     * 杜绝"已标退款但钱从未退回"的假退款脏数据。
     */
    private executeRefund;
    /** 幂等地把售后单置为 RefundFailed（不入事务，供 catch 兜底），避免异常路径留下半成品脏数据 */
    private applyRefundFailed;
    /**
     * 回写 Order customFields.afterSalesStatus。失败仅告警，不影响主流程。
     */
    private updateOrderAfterSalesStatus;
    /** Admin 单查：加载 order/orderLine/customer/history（web-admin 详情页专用，替代列表过滤 hack） */
    findOneForAdmin(ctx: RequestContext, id: ID): Promise<AfterSalesRequest | undefined>;
    /** 批量同意：复用单条方法逐条执行，单条失败不中断整批。上限 50。 */
    batchApprove(ctx: RequestContext, ids: ID[]): Promise<Array<{
        id: string;
        success: boolean;
        state: string;
        message: string;
    }>>;
    /** 批量拒绝：同 batchApprove，整批共用一个 reason。 */
    batchReject(ctx: RequestContext, ids: ID[], reason: string): Promise<Array<{
        id: string;
        success: boolean;
        state: string;
        message: string;
    }>>;
    /** 读当前渠道售后寄回地址（Admin/Shop 共用；未配置返回空串） */
    getReturnAddress(ctx: RequestContext): Promise<string>;
    /** 写当前渠道售后寄回地址（走 ChannelService.update，免开 ChannelService 权限） */
    updateReturnAddress(ctx: RequestContext, address: string): Promise<boolean>;
    /**
     * 售后数据看板聚合（三期设计 §四）：窗口申请总数 / 仍 Pending / 实退总额 / 平均处理时长 / 按日 / 按状态 / 按类型。
     * from/to 接受 'YYYY-MM-DD' 或完整 ISO 串（纯日期的 to 按当日 23:59:59.999 收口）。
     * 分日聚合用 SUBSTR(createdAt,1,10)（sqlite/mysql 均支持）；平均处理时长用 JS 计算避免跨库 AVG 精度差异。
     */
    stats(ctx: RequestContext, from: string, to: string): Promise<any>;
    private transitionState;
    private static readonly MESSAGE_MAX_IMAGES;
    private static readonly MESSAGE_MAX_LENGTH;
    /**
     * 追加一条协商留言。senderType=customer 供顾客发送（addAfterSalesMessage），admin 供商家回复（replyAfterSalesMessage）。
     * 售后单关闭（Closed）后禁止继续留言；图片 ≤3 张、正文 ≤1000 字。
     */
    addMessage(ctx: RequestContext, requestId: ID, senderType: AfterSalesMessageSenderType, content: string, images?: string[] | null): Promise<AfterSalesMessage>;
    /** 发送人显示名：管理员取 Administrator、顾客取 Customer（姓名拼接），失败兜底 'user' */
    private resolveSenderName;
    /**
     * 售后单留言列表（createdAt 正序，skip/take 常规分页）。
     * senderType=customer 时校验售后单归属当前顾客，防止越权读他人留言。
     */
    listMessages(ctx: RequestContext, requestId: ID, senderType: AfterSalesMessageSenderType, options?: {
        skip?: number;
        take?: number;
    }): Promise<PaginatedList<AfterSalesMessage>>;
    /** 批量统计各售后单留言条数并附加到 messageCount 非持久化属性 */
    private attachMessageCounts;
    /** 换货发货（admin）：Received → ExchangeShipped，仅 exchange 类型、仅 Received 状态可走 */
    exchangeShip(ctx: RequestContext, id: ID, trackingNo: string, carrier: string): Promise<AfterSalesRequest>;
    /** 换货确认收货（shop 顾客）：ExchangeShipped → Closed，需校验售后单归属 */
    exchangeReceive(ctx: RequestContext, id: ID): Promise<AfterSalesRequest>;
}
