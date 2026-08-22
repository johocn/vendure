import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { InvoiceService } from './invoice.service';

@Resolver()
export class InvoiceAdminResolver {
    constructor(private invoiceService: InvoiceService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    async invoices(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<any> {
        return this.invoiceService.getInvoices(ctx, options);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async invoice(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.invoiceService.getInvoice(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async issueInvoice(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.invoiceService.issueInvoice(ctx, id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async bulkIssueInvoices(@Ctx() ctx: RequestContext, @Args('ids', { type: () => [String] }) ids: string[]): Promise<any> {
        return this.invoiceService.bulkIssueInvoices(ctx, ids);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async reverseInvoice(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('reason') reason: string,
        @Args('reverseAmount', { type: () => Number, nullable: true }) reverseAmount?: number,
    ): Promise<any> {
        return this.invoiceService.reverseInvoice(ctx, id, reason, reverseAmount);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    async voidInvoice(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('reason') reason: string): Promise<any> {
        return this.invoiceService.voidInvoice(ctx, id, reason);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    async exportInvoicesCsv(@Ctx() ctx: RequestContext, @Args('options', { nullable: true }) options: any): Promise<string> {
        return this.invoiceService.exportInvoicesCsv(ctx, options);
    }
}
