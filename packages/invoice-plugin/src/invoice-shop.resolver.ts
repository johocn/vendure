import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { InvoiceService } from './invoice.service';

@Resolver()
export class InvoiceShopResolver {
    constructor(private invoiceService: InvoiceService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myInvoices(@Ctx() ctx: RequestContext): Promise<any> {
        return this.invoiceService.getMyInvoices(ctx);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myInvoice(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.invoiceService.getMyInvoice(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createInvoice(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.invoiceService.createInvoice(ctx, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async downloadInvoicePdf(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.invoiceService.downloadPdf(ctx, id);
    }
}
