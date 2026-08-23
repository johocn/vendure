import { ID, ListQueryOptions, PaginatedList, RequestContext } from '@vendure/core';
import { PaymentTemplateService } from './payment-template.service';
import { PaymentTemplate } from './payment-template.entity';
export declare class PaymentTemplateAdminResolver {
    private paymentTemplateService;
    constructor(paymentTemplateService: PaymentTemplateService);
    paymentTemplates(ctx: RequestContext, options: ListQueryOptions<PaymentTemplate>): Promise<PaginatedList<PaymentTemplate>>;
    paymentTemplate(ctx: RequestContext, id: ID): Promise<PaymentTemplate | undefined>;
    createPaymentTemplate(ctx: RequestContext, input: any): Promise<PaymentTemplate>;
    updatePaymentTemplate(ctx: RequestContext, input: any): Promise<PaymentTemplate>;
    deletePaymentTemplate(ctx: RequestContext, id: ID): Promise<boolean>;
    createPaymentMethodFromTemplate(ctx: RequestContext, templateId: ID, name?: string, code?: string): Promise<any>;
}
