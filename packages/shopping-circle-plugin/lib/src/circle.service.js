"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircleService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const circle_favorite_entity_1 = require("./circle-favorite.entity");
const circle_like_entity_1 = require("./circle-like.entity");
const circle_post_entity_1 = require("./circle-post.entity");
const MAX_TITLE_LENGTH = 50;
const CIRCLE_POST_STATUSES = ['published', 'hidden'];
function parseImages(raw) {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    }
    catch (_a) {
        return [];
    }
}
let CircleService = class CircleService {
    constructor(connection, customerService) {
        this.connection = connection;
        this.customerService = customerService;
    }
    /** 解析当前登录顾客（checkin.service requireCustomer 同款口径，存 Customer.id）。 */
    async requireCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.EntityNotFoundError('Customer', ctx.activeUserId);
        }
        return customer;
    }
    /** 游客浏览时解析 viewer 的 Customer.id，未登录返回 undefined。 */
    async optionalCustomerId(ctx) {
        if (!ctx.activeUserId) {
            return undefined;
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        return customer ? customer.id : undefined;
    }
    async getPostOrThrow(ctx, postId) {
        const post = await this.connection
            .getRepository(ctx, circle_post_entity_1.CirclePost)
            .findOne({ where: { id: postId, channelId: ctx.channelId } });
        if (!post) {
            throw new core_1.UserInputError(`CirclePost ${postId} not found`);
        }
        return post;
    }
    /** 给帖子附加 nickname（逐条取 firstName，取不到给 '用户'）与 viewer 的点赞/收藏状态。 */
    async decorateViews(ctx, posts, viewerCustomerId) {
        var _a;
        if (!posts.length) {
            return [];
        }
        const postIds = posts.map(p => p.id);
        let likedIds = new Set();
        let favoritedIds = new Set();
        if (viewerCustomerId) {
            const [likes, favorites] = await Promise.all([
                this.connection
                    .getRepository(ctx, circle_like_entity_1.CircleLike)
                    .find({ where: { customerId: viewerCustomerId, postId: (0, typeorm_1.In)(postIds) } }),
                this.connection
                    .getRepository(ctx, circle_favorite_entity_1.CircleFavorite)
                    .find({ where: { customerId: viewerCustomerId, postId: (0, typeorm_1.In)(postIds) } }),
            ]);
            likedIds = new Set(likes.map(l => l.postId));
            favoritedIds = new Set(favorites.map(f => f.postId));
        }
        const nicknames = new Map();
        for (const post of posts) {
            if (!nicknames.has(post.customerId)) {
                const customer = await this.customerService.findOne(ctx, post.customerId);
                nicknames.set(post.customerId, ((_a = customer === null || customer === void 0 ? void 0 : customer.firstName) === null || _a === void 0 ? void 0 : _a.trim()) || '用户');
            }
        }
        return posts.map(post => {
            var _a;
            return (Object.assign(Object.assign({}, post), { nickname: (_a = nicknames.get(post.customerId)) !== null && _a !== void 0 ? _a : '用户', images: parseImages(post.images), viewerLiked: likedIds.has(post.id), viewerFavorited: favoritedIds.has(post.id) }));
        });
    }
    /** shop：购物圈 feed（渠道隔离 + 仅 published，置顶在前、其余按 id 倒序）。游客可访问。 */
    async feed(ctx, options, viewerCustomerId) {
        const vid = viewerCustomerId !== null && viewerCustomerId !== void 0 ? viewerCustomerId : (await this.optionalCustomerId(ctx));
        const [posts, totalItems] = await this.connection
            .getRepository(ctx, circle_post_entity_1.CirclePost)
            .createQueryBuilder('post')
            .where('post.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('post.status = :status', { status: 'published' })
            .orderBy('post.isPinned', 'DESC')
            .addOrderBy('post.id', 'DESC')
            .skip(options === null || options === void 0 ? void 0 : options.skip)
            .take(options === null || options === void 0 ? void 0 : options.take)
            .getManyAndCount();
        return { items: await this.decorateViews(ctx, posts, vid), totalItems };
    }
    /** shop：我的帖子（含被隐藏的，作者自查可见）。 */
    async myPosts(ctx, options) {
        const customer = await this.requireCustomer(ctx);
        const [posts, totalItems] = await this.connection
            .getRepository(ctx, circle_post_entity_1.CirclePost)
            .createQueryBuilder('post')
            .where('post.channelId = :channelId', { channelId: ctx.channelId })
            .andWhere('post.customerId = :customerId', { customerId: customer.id })
            .orderBy('post.id', 'DESC')
            .skip(options === null || options === void 0 ? void 0 : options.skip)
            .take(options === null || options === void 0 ? void 0 : options.take)
            .getManyAndCount();
        return { items: await this.decorateViews(ctx, posts, customer.id), totalItems };
    }
    /** shop：帖子详情（游客可访问）。 */
    async findOne(ctx, id) {
        const post = await this.connection
            .getRepository(ctx, circle_post_entity_1.CirclePost)
            .findOne({ where: { id, channelId: ctx.channelId } });
        if (!post) {
            return undefined;
        }
        return (await this.decorateViews(ctx, [post], await this.optionalCustomerId(ctx)))[0];
    }
    /** shop：发帖（登录、title ≤50、images 数组 JSON 化，默认 published）。 */
    async createPost(ctx, input) {
        var _a, _b, _c, _d, _e, _f;
        const customer = await this.requireCustomer(ctx);
        const title = (_b = (_a = input.title) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
        if (title.length > MAX_TITLE_LENGTH) {
            throw new core_1.UserInputError(`title must be at most ${MAX_TITLE_LENGTH} characters`);
        }
        const content = (_d = (_c = input.content) === null || _c === void 0 ? void 0 : _c.trim()) !== null && _d !== void 0 ? _d : '';
        if (!content) {
            throw new core_1.UserInputError('content is required');
        }
        const repo = this.connection.getRepository(ctx, circle_post_entity_1.CirclePost);
        const saved = (await repo.save({
            customerId: customer.id,
            title: title || null,
            content,
            images: Array.isArray(input.images) && input.images.length ? JSON.stringify(input.images) : null,
            videoUrl: ((_e = input.videoUrl) === null || _e === void 0 ? void 0 : _e.trim()) || null,
            productId: (_f = input.productId) !== null && _f !== void 0 ? _f : null,
            likeCount: 0,
            favoriteCount: 0,
            status: 'published',
            isPinned: false,
            channel: { id: ctx.channelId },
            channelId: ctx.channelId,
        }));
        core_1.Logger.info(`CirclePost ${saved.id} created by customer ${customer.id}`, constants_1.loggerCtx);
        return (await this.decorateViews(ctx, [saved], customer.id))[0];
    }
    /** 点赞切换：存在即取消（删行 + 计数 -1），否则插入（+1）。计数与行写同方法，resolver 端 @Transaction() 包裹。 */
    async toggleLike(ctx, postId) {
        const customer = await this.requireCustomer(ctx);
        const post = await this.getPostOrThrow(ctx, postId);
        const likeRepo = this.connection.getRepository(ctx, circle_like_entity_1.CircleLike);
        const existing = await likeRepo.findOne({ where: { postId: post.id, customerId: customer.id } });
        let liked;
        if (existing) {
            await likeRepo.remove(existing);
            post.likeCount = Math.max(0, post.likeCount - 1);
            liked = false;
        }
        else {
            await likeRepo.save({
                postId: post.id,
                customerId: customer.id,
                channelId: ctx.channelId,
            });
            post.likeCount += 1;
            liked = true;
        }
        await this.connection.getRepository(ctx, circle_post_entity_1.CirclePost).save(post);
        const favorited = !!(await this.connection
            .getRepository(ctx, circle_favorite_entity_1.CircleFavorite)
            .findOne({ where: { postId: post.id, customerId: customer.id } }));
        core_1.Logger.info(`CirclePost ${post.id} like toggled by customer ${customer.id} -> ${liked}`, constants_1.loggerCtx);
        return { liked, favorited, likeCount: post.likeCount, favoriteCount: post.favoriteCount };
    }
    /** 收藏切换：与 toggleLike 同构。 */
    async toggleFavorite(ctx, postId) {
        const customer = await this.requireCustomer(ctx);
        const post = await this.getPostOrThrow(ctx, postId);
        const favoriteRepo = this.connection.getRepository(ctx, circle_favorite_entity_1.CircleFavorite);
        const existing = await favoriteRepo.findOne({ where: { postId: post.id, customerId: customer.id } });
        let favorited;
        if (existing) {
            await favoriteRepo.remove(existing);
            post.favoriteCount = Math.max(0, post.favoriteCount - 1);
            favorited = false;
        }
        else {
            await favoriteRepo.save({
                postId: post.id,
                customerId: customer.id,
                channelId: ctx.channelId,
            });
            post.favoriteCount += 1;
            favorited = true;
        }
        await this.connection.getRepository(ctx, circle_post_entity_1.CirclePost).save(post);
        const liked = !!(await this.connection
            .getRepository(ctx, circle_like_entity_1.CircleLike)
            .findOne({ where: { postId: post.id, customerId: customer.id } }));
        core_1.Logger.info(`CirclePost ${post.id} favorite toggled by customer ${customer.id} -> ${favorited}`, constants_1.loggerCtx);
        return { liked, favorited, likeCount: post.likeCount, favoriteCount: post.favoriteCount };
    }
    /** admin：帖子分页（不过滤 status，渠道隔离，id 倒序）。 */
    async adminFeed(ctx, options) {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, circle_post_entity_1.CirclePost)
            .createQueryBuilder('post')
            .where('post.channelId = :channelId', { channelId: ctx.channelId })
            .orderBy('post.id', 'DESC')
            .skip(options === null || options === void 0 ? void 0 : options.skip)
            .take(options === null || options === void 0 ? void 0 : options.take)
            .getManyAndCount();
        return { items, totalItems };
    }
    /** admin：隐藏/恢复 + 置顶切换。 */
    async updatePost(ctx, input) {
        const post = await this.getPostOrThrow(ctx, input.id);
        if (input.status != null) {
            if (!CIRCLE_POST_STATUSES.includes(input.status)) {
                throw new core_1.UserInputError(`Invalid status "${input.status}"`);
            }
            post.status = input.status;
        }
        if (input.isPinned != null) {
            post.isPinned = input.isPinned;
        }
        const saved = await this.connection.getRepository(ctx, circle_post_entity_1.CirclePost).save(post);
        core_1.Logger.info(`CirclePost ${saved.id} updated (status=${saved.status}, isPinned=${saved.isPinned})`, constants_1.loggerCtx);
        return saved;
    }
};
exports.CircleService = CircleService;
exports.CircleService = CircleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection,
        core_1.CustomerService])
], CircleService);
//# sourceMappingURL=circle.service.js.map