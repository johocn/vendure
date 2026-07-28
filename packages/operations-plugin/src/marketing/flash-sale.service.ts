import { Injectable } from '@nestjs/common';
import {
    ForbiddenError,
    ID,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
} from '@vendure/core';
import { FlashSaleService } from '@vendure/flash-sale-plugin';

import { OperationsPermissions } from '../constants';

@Injectable()
export class FlashSaleMarketingService {
    constructor(private flashSaleService: FlashSaleService) {}

    private assertPermission(ctx: RequestContext): void {
        if (!ctx.userHasPermissions([OperationsPermissions.ManageFlashSale as any])) {
            throw new ForbiddenError();
        }
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<any>,
    ): Promise<PaginatedList<any>> {
        this.assertPermission(ctx);
        return this.flashSaleService.findAll(ctx, options as any);
    }

    async findOne(ctx: RequestContext, id: ID): Promise<any | undefined> {
        this.assertPermission(ctx);
        return this.flashSaleService.findOne(ctx, id);
    }

    async create(ctx: RequestContext, input: any): Promise<any> {
        this.assertPermission(ctx);
        return this.flashSaleService.create(ctx, input);
    }

    async update(ctx: RequestContext, input: any): Promise<any> {
        this.assertPermission(ctx);
        return this.flashSaleService.update(ctx, input);
    }

    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        this.assertPermission(ctx);
        await this.flashSaleService.delete(ctx, id);
        return true;
    }
}
