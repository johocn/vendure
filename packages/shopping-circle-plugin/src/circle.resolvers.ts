import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, PaginatedList, Permission, RequestContext, Transaction } from '@vendure/core';

import { CircleService } from './circle.service';
import { CirclePost } from './circle-post.entity';
import { CirclePostListOptions, CirclePostView, CreateCirclePostInput, ToggleCircleResult, UpdateCirclePostInput } from './types';

@Resolver()
export class CircleShopResolver {
    constructor(private circleService: CircleService) {}

    /** 游客可浏览 feed（对齐 usemall），不加 @Allow。 */
    @Query()
    async circleFeed(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: CirclePostListOptions,
    ): Promise<PaginatedList<CirclePostView>> {
        return this.circleService.feed(ctx, options);
    }

    @Query()
    @Allow(Permission.Authenticated)
    async myCirclePosts(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: CirclePostListOptions,
    ): Promise<PaginatedList<CirclePostView>> {
        return this.circleService.myPosts(ctx, options);
    }

    /** 游客可看详情，不加 @Allow。 */
    @Query()
    async circlePost(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<CirclePostView | undefined> {
        return this.circleService.findOne(ctx, id);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async createCirclePost(
        @Ctx() ctx: RequestContext,
        @Args('input') input: CreateCirclePostInput,
    ): Promise<CirclePostView> {
        return this.circleService.createPost(ctx, input);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async toggleCircleLike(@Ctx() ctx: RequestContext, @Args('postId') postId: ID): Promise<ToggleCircleResult> {
        return this.circleService.toggleLike(ctx, postId);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async toggleCircleFavorite(@Ctx() ctx: RequestContext, @Args('postId') postId: ID): Promise<ToggleCircleResult> {
        return this.circleService.toggleFavorite(ctx, postId);
    }
}

@Resolver()
export class CircleAdminResolver {
    constructor(private circleService: CircleService) {}

    @Query()
    @Allow(Permission.ReadSettings)
    async circlePosts(
        @Ctx() ctx: RequestContext,
        @Args('options', { nullable: true }) options?: CirclePostListOptions,
    ): Promise<PaginatedList<CirclePost>> {
        return this.circleService.adminFeed(ctx, options);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateSettings)
    async updateCirclePost(
        @Ctx() ctx: RequestContext,
        @Args('input') input: UpdateCirclePostInput,
    ): Promise<CirclePost> {
        return this.circleService.updatePost(ctx, input);
    }
}
