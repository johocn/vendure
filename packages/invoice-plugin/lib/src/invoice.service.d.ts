import { ID, Injector, ListQueryBuilder, ListQueryOptions, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { Invoice, InvoiceType } from './invoice.entity';
export interface CreateInvoiceInput {
    orderIds: ID[];
    invoiceType: InvoiceType | string;
    title: string;
    taxNumber?: string;
    email?: string;
    companyAddress?: string;
    companyPhone?: string;
    bankName?: string;
    bankAccount?: string;
    amount?: number;
    /** 复用已存抬头：命中后回填抬头/税号/邮箱/地址/开户行/账号到发票快照 */
    invoiceTitleId?: ID;
}
export declare class InvoiceService {
    private connection;
    private listQueryBuilder;
    private orderService;
    private titleService;
    private options;
    private provider;
    constructor(connection: TransactionalConnection, listQueryBuilder: ListQueryBuilder);
    init(injector: Injector): void;
    getInvoice(ctx: RequestContext, id: ID): Promise<Invoice | undefined>;
    getInvoices(ctx: RequestContext, options?: ListQueryOptions<Invoice>): Promise<PaginatedList<Invoice>>;
    getMyInvoices(ctx: RequestContext): Promise<Invoice[]>;
    getMyInvoice(ctx: RequestContext, id: ID): Promise<Invoice | undefined>;
    createInvoice(ctx: RequestContext, input: CreateInvoiceInput): Promise<Invoice>;
    issueInvoice(ctx: RequestContext, id: ID): Promise<Invoice>;
    /** 自动开票：按订单自定义字段开票（autoIssue 开关开启时，订单进入可开票状态由 plugin 触发）。
     *  该方法以系统身份开票，不校验 activeUserId 归属（自动流不限定客户前端）。 */
    autoIssueForOrder(ctx: RequestContext, orderId: ID): Promise<Invoice | null>;
    /** 批量开票：逐张签发，单张失败不阻塞其他；返回全部结果（含 lastError） */
    bulkIssueInvoices(ctx: RequestContext, ids: ID[]): Promise<Invoice[]>;
    /** 归一化发票号：INV-{yyyyMMdd}-{channelId}-{seq}（seq=同渠道当日已签发发票数+1） */
    private generateInvoiceNo;
    /** 把订单行聚合为价税分离快照（供 PDF / 展示复用，与订单解耦） */
    private buildLinesSnapshot;
    /** 从订单行解析税率（%） */
    private taxRateOf;
    /** 发票合规校验（轻量）：专票必填三要素+税号；税号格式（提示，不阻止 mock 开票） */
    private assertCompliant;
    /**
     * 红冲发票：
     * - 不传 reverseAmount 或金额 ≥ 剩余可红冲金额 → 全量红冲：状态 → REVERSED。
     * - 0 < reverseAmount < 剩余可红冲金额 → 部分红冲：生成一条红字票（isRed，amount 为负，parentInvoiceId=原票），
     *   原票状态 → PARTIALLY_REVERSED 并累计 reversedAmount（原票保留，可继续补红）。
     * 说明：未接真实税控服务商，红字票仅作记录/留痕，不产生第三方红字文件。
     */
    reverseInvoice(ctx: RequestContext, id: ID, reason: string, reverseAmount?: number): Promise<Invoice>;
    /** 部分红冲：生成红字票，原票保持可继续补红 */
    private partialReverse;
    /** 作废（留痕）：仅 PENDING/FAILED 的票可作废；作废后可重开同一订单 */
    voidInvoice(ctx: RequestContext, id: ID, reason: string): Promise<Invoice>;
    /** 导出发票为 CSV（UTF-8 BOM，兼容 Excel 中文）；options 复用列表查询过滤 */
    exportInvoicesCsv(ctx: RequestContext, options?: ListQueryOptions<Invoice>): Promise<string>;
    private notifyInvoiceEvent;
    downloadPdf(ctx: RequestContext, id: ID): Promise<Invoice>;
}
