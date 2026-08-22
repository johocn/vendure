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
