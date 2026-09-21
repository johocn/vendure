import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext, Transaction } from '@vendure/core';
import { ShopTemplateService } from './shop-template.service';
import {
    shopTemplatesCreate,
    shopTemplatesDelete,
    shopTemplatesRead,
    shopTemplatesUpdate,
} from './permissions';
import { ShopTemplate } from './shop-template.entity';
import { ShopGlobalConfig } from './shop-global-config.entity';
import { ShopTemplateVersion } from './shop-template-version.entity';
import { PALETTE_PRESETS } from './palette-presets';

/** 引用该模板的渠道（与 SDL TemplateReference 对应） */
interface TemplateReferenceResult {
    channelId: string;
    channelCode: string;
    channelName: string;
    app: string;
}

/** 合并预览（与 SDL MergedPreview 对应） */
interface MergedPreviewResult {
    merged: any;
    sourceByKey: Record<string, string>;
}

@Resolver()
export class ShopTemplateAdminResolver {
    constructor(private service: ShopTemplateService) {}

    @Query()
    @Allow(shopTemplatesRead.Permission)
    async shopTemplates(@Ctx() ctx: RequestContext, @Args('app') app?: string): Promise<ShopTemplate[]> {
        return this.service.findAll(ctx, app as any);
    }

    @Query()
    @Allow(shopTemplatesRead.Permission)
    async shopTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<ShopTemplate | null> {
        return this.service.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(shopTemplatesCreate.Permission)
    async createShopTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<ShopTemplate> {
        return this.service.create(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(shopTemplatesUpdate.Permission)
    async updateShopTemplate(@Ctx() ctx: RequestContext, @Args('input') input: any): Promise<ShopTemplate> {
        return this.service.update(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(shopTemplatesDelete.Permission)
    async deleteShopTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.service.delete(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(shopTemplatesCreate.Permission)
    async copyShopTemplate(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<ShopTemplate> {
        return this.service.copy(ctx, id);
    }

    @Query()
    @Allow(shopTemplatesRead.Permission)
    async shopGlobalConfig(
        @Ctx() ctx: RequestContext,
        @Args('app') app: string,
    ): Promise<ShopGlobalConfig | null> {
        return this.service.findGlobalConfig(ctx, app as any);
    }

    @Mutation()
    @Transaction()
    @Allow(shopTemplatesUpdate.Permission)
    async updateShopGlobalConfig(
        @Ctx() ctx: RequestContext,
        @Args('input') input: any,
    ): Promise<ShopGlobalConfig> {
        return this.service.upsertGlobalConfig(ctx, input);
    }

    /* --------------------- 版本快照 / 回滚 / 引用 / 合并预览 --------------------- */

    @Query()
    @Allow(shopTemplatesRead.Permission)
    async templateVersions(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<ShopTemplateVersion[]> {
        return this.service.versions(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(shopTemplatesUpdate.Permission)
    async restoreTemplateVersion(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
        @Args('version') version: number,
    ): Promise<ShopTemplate> {
        return this.service.restore(ctx, id, version);
    }

    @Query()
    @Allow(shopTemplatesRead.Permission)
    async templateReferences(
        @Ctx() ctx: RequestContext,
        @Args('id') id: ID,
    ): Promise<TemplateReferenceResult[]> {
        return this.service.references(ctx, id);
    }

    @Query()
    @Allow(shopTemplatesRead.Permission)
    async templateMergedPreview(
        @Ctx() ctx: RequestContext,
        @Args('app') app: string,
        @Args('templateId', { nullable: true }) templateId?: ID,
        @Args({ name: 'overrides', type: () => Object, nullable: true }) overrides?: any,
    ): Promise<MergedPreviewResult> {
        return this.service.mergedPreview(ctx, app as any, templateId, overrides);
    }

    @Query()
    @Allow(shopTemplatesRead.Permission)
    async palettePresets(): Promise<Record<string, any>> {
        return PALETTE_PRESETS;
    }
}
