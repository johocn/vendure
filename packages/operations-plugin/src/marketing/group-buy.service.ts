import { Injectable } from '@nestjs/common';
import {
    ForbiddenError,
    ID,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
} from '@vendure/core';
import { GroupBuyService } from '@vendure/group-buy-plugin';

import { OperationsPermissions } from '../constants';

@Injectable()
export class GroupBuyMarketingService {
    constructor(private groupBuyService: GroupBuyService) {}

    private assertPermission(ctx: RequestContext): void {
        if (!ctx.userHasPermissions([OperationsPermissions.ManageGroupBuy as any])) {
            throw new ForbiddenError();
        }
    }

    async findAll(
        ctx: RequestContext,
        options?: ListQueryOptions<any>,
    ): Promise<PaginatedList<any>> {
        this.assertPermission(ctx);
        return this.groupBuyService.findAll(ctx, options as any);
    }

    async findOne(ctx: RequestContext, id: ID): Promise<any | undefined> {
        this.assertPermission(ctx);
        return this.groupBuyService.findOne(ctx, id);
    }

    async create(ctx: RequestContext, input: any): Promise<any> {
        this.assertPermission(ctx);
        return this.groupBuyService.create(ctx, input);
    }

    async update(ctx: RequestContext, input: any): Promise<any> {
        this.assertPermission(ctx);
        return this.groupBuyService.update(ctx, input);
    }

    async delete(ctx: RequestContext, id: ID): Promise<boolean> {
        this.assertPermission(ctx);
        await this.groupBuyService.delete(ctx, id);
        return true;
    }
}
