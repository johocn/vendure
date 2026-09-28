import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Asset,
    AssetService,
    Ctx,
    isGraphQlErrorResult,
    Permission,
    RequestContext,
    Transaction,
    UserInputError,
} from '@vendure/core';

/**
 * C 端客户资产上传（F-VS-09）。
 *
 * 售后凭证等场景需要客户端把图片上传到服务端并拿到**可持久访问的 URL**，
 * 而不是把本地临时路径直接当 URL 入库（原实现为占位）。
 * 复用核心 AssetService：服务端按 assetOptions.permittedMimeTypes 校验 MIME、
 * 生成预览图并落库；返回的 Asset 由 AssetInterceptorPlugin 统一转为绝对 URL。
 */
@Resolver()
export class CustomerAssetShopResolver {
    constructor(private assetService: AssetService) {}

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async uploadCustomerAsset(@Ctx() ctx: RequestContext, @Args() args: { file: any }): Promise<Asset> {
        const result = await this.assetService.create(ctx, { file: args.file });
        if (isGraphQlErrorResult(result)) {
            // MimeTypeError 等：以 UserInputError 抛出，避免前端拿到静默空值
            throw new UserInputError(result.message);
        }
        return result;
    }
}
