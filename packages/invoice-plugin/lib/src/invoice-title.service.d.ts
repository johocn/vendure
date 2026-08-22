import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { InvoiceTitle } from './invoice-title.entity';
export interface CreateInvoiceTitleInput {
    title: string;
    taxNumber?: string;
    email?: string;
    companyAddress?: string;
    companyPhone?: string;
    bankName?: string;
    bankAccount?: string;
    isDefault?: boolean;
}
export interface UpdateInvoiceTitleInput extends Partial<CreateInvoiceTitleInput> {
}
export declare class InvoiceTitleService {
    private connection;
    constructor(connection: TransactionalConnection);
    private findOwned;
    /** 供发票创建复用：按 id 取抬头（管理员可为客户代取）。不强制归属当前 activeUser。 */
    getOwned(ctx: RequestContext, id: ID): Promise<InvoiceTitle>;
    listMine(ctx: RequestContext): Promise<InvoiceTitle[]>;
    create(ctx: RequestContext, input: CreateInvoiceTitleInput): Promise<InvoiceTitle>;
    update(ctx: RequestContext, id: ID, input: UpdateInvoiceTitleInput): Promise<InvoiceTitle>;
    setDefault(ctx: RequestContext, id: ID): Promise<InvoiceTitle>;
    delete(ctx: RequestContext, id: ID): Promise<{
        success: boolean;
    }>;
    /** 把同用户其他抬头 isDefault 清掉（trx 内） */
    private clearOthersDefault;
}
