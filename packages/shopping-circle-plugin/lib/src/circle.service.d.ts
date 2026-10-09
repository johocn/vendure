import { CustomerService, ID, PaginatedList, RequestContext, TransactionalConnection } from '@vendure/core';
import { CirclePost } from './circle-post.entity';
import { CirclePostListOptions, CirclePostView, CreateCirclePostInput, ToggleCircleResult, UpdateCirclePostInput } from './types';
export declare class CircleService {
    private connection;
    private customerService;
    constructor(connection: TransactionalConnection, customerService: CustomerService);
    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径，存 Customer.id）。 */
    private requireCustomer;
    /** 游客浏览时解析 viewer 的 Customer.id，未登录返回 undefined。 */
    private optionalCustomerId;
    private getPostOrThrow;
    /** 给帖子附加 nickname（逐条取 firstName，取不到给 '用户'）与 viewer 的点赞/收藏状态。 */
    private decorateViews;
    /** shop：购物圈 feed（渠道隔离 + 仅 published，置顶在前、其余按 id 倒序）。游客可访问。 */
    feed(ctx: RequestContext, options?: CirclePostListOptions, viewerCustomerId?: number): Promise<PaginatedList<CirclePostView>>;
    /** shop：我的帖子（含被隐藏的，作者自查可见）。 */
    myPosts(ctx: RequestContext, options?: CirclePostListOptions): Promise<PaginatedList<CirclePostView>>;
    /** shop：帖子详情（游客可访问）。 */
    findOne(ctx: RequestContext, id: ID): Promise<CirclePostView | undefined>;
    /** shop：发帖（登录、title ≤50、images 数组 JSON 化，默认 published）。 */
    createPost(ctx: RequestContext, input: CreateCirclePostInput): Promise<CirclePostView>;
    /** 点赞切换：存在即取消（删行 + 计数 -1），否则插入（+1）。计数与行写同方法，resolver 端 @Transaction() 包裹。 */
    toggleLike(ctx: RequestContext, postId: ID): Promise<ToggleCircleResult>;
    /** 收藏切换：与 toggleLike 同构。 */
    toggleFavorite(ctx: RequestContext, postId: ID): Promise<ToggleCircleResult>;
    /** admin：帖子分页（不过滤 status，渠道隔离，id 倒序）。 */
    adminFeed(ctx: RequestContext, options?: CirclePostListOptions): Promise<PaginatedList<CirclePost>>;
    /** admin：隐藏/恢复 + 置顶切换。 */
    updatePost(ctx: RequestContext, input: UpdateCirclePostInput): Promise<CirclePost>;
}
