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
}
export declare class InvoiceService {
    private connection;
    private listQueryBuilder;
    private orderService;
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
    reverseInvoice(ctx: RequestContext, id: ID, reason: string): Promise<Invoice>;
    downloadPdf(ctx: RequestContext, id: ID): Promise<Invoice>;
}
