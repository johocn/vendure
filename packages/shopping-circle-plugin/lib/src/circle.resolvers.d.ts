import { ID, PaginatedList, RequestContext } from '@vendure/core';
import { CircleService } from './circle.service';
import { CirclePost } from './circle-post.entity';
import { CirclePostListOptions, CirclePostView, CreateCirclePostInput, ToggleCircleResult, UpdateCirclePostInput } from './types';
export declare class CircleShopResolver {
    private circleService;
    constructor(circleService: CircleService);
    /** 游客可浏览 feed（对齐 usemall），不加 @Allow。 */
    circleFeed(ctx: RequestContext, options?: CirclePostListOptions): Promise<PaginatedList<CirclePostView>>;
    myCirclePosts(ctx: RequestContext, options?: CirclePostListOptions): Promise<PaginatedList<CirclePostView>>;
    /** 游客可看详情，不加 @Allow。 */
    circlePost(ctx: RequestContext, id: ID): Promise<CirclePostView | undefined>;
    createCirclePost(ctx: RequestContext, input: CreateCirclePostInput): Promise<CirclePostView>;
    toggleCircleLike(ctx: RequestContext, postId: ID): Promise<ToggleCircleResult>;
    toggleCircleFavorite(ctx: RequestContext, postId: ID): Promise<ToggleCircleResult>;
}
export declare class CircleAdminResolver {
    private circleService;
    constructor(circleService: CircleService);
    circlePosts(ctx: RequestContext, options?: CirclePostListOptions): Promise<PaginatedList<CirclePost>>;
    updateCirclePost(ctx: RequestContext, input: UpdateCirclePostInput): Promise<CirclePost>;
}
