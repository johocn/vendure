import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext } from '@vendure/core';

import { OperationItem } from './operation-item.entity';
import { OperationSection } from './operation-section.entity';
import { OperationService } from './operation.service';

@Resolver('OperationItem')
export class OperationShopResolver {
    constructor(private operationService: OperationService) {}

    @Query()
    @Allow(Permission.Public)
    async operationSections(@Ctx() ctx: RequestContext): Promise<OperationSection[]> {
        const sections = await this.operationService.listEnabled(ctx);
        await this.operationService.resolveTargets(ctx, sections);
        return sections;
    }

    @Query()
    @Allow(Permission.Public)
    async operationSection(
        @Ctx() ctx: RequestContext,
        @Args('code') code: string,
    ): Promise<OperationSection | null> {
        const section = await this.operationService.getEnabledByCode(ctx, code);
        if (!section) {
            return null;
        }
        await this.operationService.resolveTargets(ctx, [section]);
        return section;
    }

    @ResolveField()
    async product(@Ctx() _ctx: RequestContext, @Parent() item: OperationItem): Promise<any> {
        return (item as any).__product ?? null;
    }

    @ResolveField()
    async imageUrl(@Ctx() _ctx: RequestContext, @Parent() item: OperationItem): Promise<string | null> {
        return (item as any).__imageUrl ?? null;
    }
}