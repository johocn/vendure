import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import {
    Customer,
    CustomerService,
    EntityNotFoundError,
    ID,
    Logger,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { CircleFavorite } from './circle-favorite.entity';
import { CircleLike } from './circle-like.entity';
import { CirclePost } from './circle-post.entity';
import { CirclePostListOptions, CirclePostView, CreateCirclePostInput, ToggleCircleResult, UpdateCirclePostInput } from './types';

const MAX_TITLE_LENGTH = 50;

const CIRCLE_POST_STATUSES: Array<CirclePost['status']> = ['published', 'hidden'];

function parseImages(raw: string | null): string[] {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

@Injectable()
export class CircleService {
    constructor(
        private connection: TransactionalConnection,
        private customerService: CustomerService,
    ) {}

    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径，存 Customer.id）。 */
    private async requireCustomer(ctx: RequestContext): Promise<Customer> {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }

    /** 游客浏览时解析 viewer 的 Customer.id，未登录返回 undefined。 */
    private async optionalCustomerId(ctx: RequestContext): Promise<number | undefined> {
        if (!ctx.activeUserId) {
            return undefined;
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        return customer ? (customer.id as number) : undefined;
    }

    private async getPostOrThrow(ctx: RequestContext, postId: ID): Promise<CirclePost> {
        const post = await this.connection
            .getRepository(ctx, CirclePost)
            .findOne({ where: { id: postId, channelId: ctx.channelId } as any });
        if (!post) {
            throw new UserInputError(`CirclePost ${postId} not found`);
        }
        return post;
    }

    /** 给帖子附加 nickname（逐条取 firstName，取不到给 '用户'）与 viewer 的点赞/收藏状态。 */
    private async decorateViews(ctx: RequestContext, posts: CirclePost[], viewerCustomerId?: number): Promise<CirclePostView[]> {
        if (!posts.length) {
            return [];
        }
        const postIds = posts.map(p => p.id);
        let likedIds = new Set<number>();
        let favoritedIds = new Set<number>();
        if (viewerCustomerId) {
            const [likes, favorites] = await Promise.all([
                this.connection
                    .getRepository(ctx, CircleLike)
                    .find({ where: { customerId: viewerCustomerId, postId: In(postIds) } as any }),
                this.connection
                    .getRepository(ctx, CircleFavorite)
                    .find({ where: { customerId: viewerCustomerId, postId: In(postIds) } as any }),
            ]);
            likedIds = new Set(likes.map(l => l.postId));
            favoritedIds = new Set(favorites.map(f => f.postId));
        }
        const nicknames = new Map<number, string>();
        for (const post of posts) {
            if (!nicknames.has(post.customerId)) {
                const customer = await this.customerService.findOne(ctx, post.customerId);
                nicknames.set(post.customerId, customer?.firstName?.trim() || '用户');
            }
        }
        return posts.map(post => ({
            ...post,
            nickname: nicknames.get(post.customerId) ?? '用户',
            images: parseImages(post.images),
            viewerLiked: likedIds.has(post.id as number),
            viewerFavorited: favoritedIds.has(post.id as number),
        }));
    }

    /** shop：购物圈 feed（渠道隔离 + 仅 published，置顶在前、其余按 id 倒序）。游客可访问。 */
    async feed(ctx: RequestContext, options?: CirclePostListOptions, viewerCustomerId?: number): Promise<PaginatedList<CirclePostView>> {
        const vid = viewerCustomerId ?? (await this.optionalCustomerId(ctx));
        const [posts, totalItems] = await this.connection
            .getRepository(ctx, CirclePost)
            .createQueryBuilder('post')
            .where('post.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('post.status = :status', { status: 'published' })
            .orderBy('post.isPinned', 'DESC')
            .addOrderBy('post.id', 'DESC')
            .skip(options?.skip)
            .take(options?.take)
            .getManyAndCount();
        return { items: await this.decorateViews(ctx, posts, vid), totalItems };
    }

    /** shop：我的帖子（含被隐藏的，作者自查可见）。 */
    async myPosts(ctx: RequestContext, options?: CirclePostListOptions): Promise<PaginatedList<CirclePostView>> {
        const customer = await this.requireCustomer(ctx);
        const [posts, totalItems] = await this.connection
            .getRepository(ctx, CirclePost)
            .createQueryBuilder('post')
            .where('post.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('post.customerId = :customerId', { customerId: customer.id })
            .orderBy('post.id', 'DESC')
            .skip(options?.skip)
            .take(options?.take)
            .getManyAndCount();
        return { items: await this.decorateViews(ctx, posts, customer.id as number), totalItems };
    }

    /** shop：帖子详情（游客可访问）。 */
    async findOne(ctx: RequestContext, id: ID): Promise<CirclePostView | undefined> {
        const post = await this.connection
            .getRepository(ctx, CirclePost)
            .findOne({ where: { id, channelId: ctx.channelId } as any });
        if (!post) {
            return undefined;
        }
        return (await this.decorateViews(ctx, [post], await this.optionalCustomerId(ctx)))[0];
    }

    /** shop：发帖（登录、title ≤50、images 数组 JSON 化，默认 published）。 */
    async createPost(ctx: RequestContext, input: CreateCirclePostInput): Promise<CirclePostView> {
        const customer = await this.requireCustomer(ctx);
        const title = input.title?.trim() ?? '';
        if (title.length > MAX_TITLE_LENGTH) {
            throw new UserInputError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
        }
        const content = input.content?.trim() ?? '';
        if (!content) {
            throw new UserInputError('content is required');
        }
        const repo = this.connection.getRepository(ctx, CirclePost);
        const saved = (await repo.save({
            customerId: customer.id as number,
            title: title || null,
            content,
            images: Array.isArray(input.images) && input.images.length ? JSON.stringify(input.images) : null,
            videoUrl: input.videoUrl?.trim() || null,
            productId: input.productId ?? null,
            likeCount: 0,
            favoriteCount: 0,
            status: 'published',
            isPinned: false,
            channel: { id: ctx.channelId },
            channelId: ctx.channelId,
        } as any)) as CirclePost;
        Logger.info(`CirclePost ${saved.id} created by customer ${customer.id}`, loggerCtx);
        return (await this.decorateViews(ctx, [saved], customer.id as number))[0];
    }

    /** 点赞切换：存在即取消（删行 + 计数 -1），否则插入（+1）。计数与行写同方法，resolver 端 @Transaction() 包裹。 */
    async toggleLike(ctx: RequestContext, postId: ID): Promise<ToggleCircleResult> {
        const customer = await this.requireCustomer(ctx);
        const post = await this.getPostOrThrow(ctx, postId);
        const likeRepo = this.connection.getRepository(ctx, CircleLike);
        const existing = await likeRepo.findOne({ where: { postId: post.id, customerId: customer.id } as any });
        let liked: boolean;
        if (existing) {
            await likeRepo.remove(existing);
            post.likeCount = Math.max(0, post.likeCount - 1);
            liked = false;
        } else {
            await likeRepo.save({
                postId: post.id as number,
                customerId: customer.id as number,
                channelId: ctx.channelId,
            } as any);
            post.likeCount += 1;
            liked = true;
        }
        await this.connection.getRepository(ctx, CirclePost).save(post);
        const favorited = !!(await this.connection
            .getRepository(ctx, CircleFavorite)
            .findOne({ where: { postId: post.id, customerId: customer.id } as any }));
        Logger.info(`CirclePost ${post.id} like toggled by customer ${customer.id} -> ${liked}`, loggerCtx);
        return { liked, favorited, likeCount: post.likeCount, favoriteCount: post.favoriteCount };
    }

    /** 收藏切换：与 toggleLike 同构。 */
    async toggleFavorite(ctx: RequestContext, postId: ID): Promise<ToggleCircleResult> {
        const customer = await this.requireCustomer(ctx);
        const post = await this.getPostOrThrow(ctx, postId);
        const favoriteRepo = this.connection.getRepository(ctx, CircleFavorite);
        const existing = await favoriteRepo.findOne({ where: { postId: post.id, customerId: customer.id } as any });
        let favorited: boolean;
        if (existing) {
            await favoriteRepo.remove(existing);
            post.favoriteCount = Math.max(0, post.favoriteCount - 1);
            favorited = false;
        } else {
            await favoriteRepo.save({
                postId: post.id as number,
                customerId: customer.id as number,
                channelId: ctx.channelId,
            } as any);
            post.favoriteCount += 1;
            favorited = true;
        }
        await this.connection.getRepository(ctx, CirclePost).save(post);
        const liked = !!(await this.connection
            .getRepository(ctx, CircleLike)
            .findOne({ where: { postId: post.id, customerId: customer.id } as any }));
        Logger.info(`CirclePost ${post.id} favorite toggled by customer ${customer.id} -> ${favorited}`, loggerCtx);
        return { liked, favorited, likeCount: post.likeCount, favoriteCount: post.favoriteCount };
    }

    /** admin：帖子分页（不过滤 status，渠道隔离，id 倒序）。 */
    async adminFeed(ctx: RequestContext, options?: CirclePostListOptions): Promise<PaginatedList<CirclePost>> {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, CirclePost)
            .createQueryBuilder('post')
            .where('post.channelId = :channelId', { channelId: ctx.channelId })
            .orderBy('post.id', 'DESC')
            .skip(options?.skip)
            .take(options?.take)
            .getManyAndCount();
        return { items, totalItems };
    }

    /** admin：隐藏/恢复 + 置顶切换。 */
    async updatePost(ctx: RequestContext, input: UpdateCirclePostInput): Promise<CirclePost> {
        const post = await this.getPostOrThrow(ctx, input.id);
        if (input.status != null) {
            if (!CIRCLE_POST_STATUSES.includes(input.status as CirclePost['status'])) {
                throw new UserInputError(`Invalid status "${input.status}"`);
            }
            post.status = input.status as CirclePost['status'];
        }
        if (input.isPinned != null) {
            post.isPinned = input.isPinned;
        }
        const saved = await this.connection.getRepository(ctx, CirclePost).save(post);
        Logger.info(`CirclePost ${saved.id} updated (status=${saved.status}, isPinned=${saved.isPinned})`, loggerCtx);
        return saved;
    }
}
