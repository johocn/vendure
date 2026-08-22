import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { InvoiceTitleService } from './invoice-title.service';

@Resolver()
export class InvoiceTitleShopResolver {
    constructor(private titleService: InvoiceTitleService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myInvoiceTitles(@Ctx() ctx: RequestContext): Promise<any> {
        return this.titleService.listMine(ctx);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async createInvoiceTitle(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<any> {
        return this.titleService.create(ctx, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async updateInvoiceTitle(@Ctx() ctx: RequestContext, @Args('id') id: ID, @Args('input') input: any): Promise<any> {
        return this.titleService.update(ctx, id, input);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async setDefaultInvoiceTitle(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<any> {
        return this.titleService.setDefault(ctx, id);
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async deleteInvoiceTitle(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        await this.titleService.delete(ctx, id);
        return true;
    }
}