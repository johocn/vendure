import { createTestEnvironment, registerInitializer, SqljsInitializer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'path';
import gql from 'graphql-tag';
import { mergeConfig } from '@vendure/core';
import { initialData } from '../../../e2e-common/e2e-initial-data';
import { TEST_SETUP_TIMEOUT_MS, testConfig } from '../../../e2e-common/test-config';
import { ShoppingCirclePlugin } from '../src/plugin';

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

describe('ShoppingCirclePlugin · 购物圈（发帖/feed/点赞/收藏/管理）', () => {
    const config = mergeConfig(testConfig(), {
        plugins: [ShoppingCirclePlugin.init()],
    });
    const { server, adminClient, shopClient } = createTestEnvironment(config);

    beforeAll(async () => {
        await server.init({
            initialData,
            productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-minimal.csv'),
            customerCount: 1,
        });
        await adminClient.asSuperAdmin();
        await shopClient.asUserWithCredentials('hayden.zieme12@hotmail.com', 'test');
    }, TEST_SETUP_TIMEOUT_MS);

    afterAll(async () => {
        await server.destroy();
    });

    it('发帖：title 51 字报错；正常发帖 → circleFeed 1 条（images 解析为数组、附 nickname/viewer 状态）', async () => {
        const longTitle = '一'.repeat(51);
        expect(longTitle.length).toBe(51);
        await expect(shopClient.query(gql`
            mutation { createCirclePost(input: { title: "${longTitle}", content: "内容" }) { id } }
        `)).rejects.toThrow(/at most 50 characters/);

        const created = await shopClient.query(gql`
            mutation {
                createCirclePost(input: {
                    title: "开箱测评"
                    content: "这个真的很好用，推荐大家入手"
                    images: ["https://cdn.example.com/p1.jpg", "https://cdn.example.com/p2.jpg"]
                    productId: "1"
                }) {
                    id title content images videoUrl productId
                    likeCount favoriteCount viewerLiked viewerFavorited isPinned nickname customerId
                }
            }
        `) as any;
        const post = created.createCirclePost;
        expect(post.title).toBe('开箱测评');
        expect(post.images).toEqual([
            'https://cdn.example.com/p1.jpg',
            'https://cdn.example.com/p2.jpg',
        ]);
        // e2e 环境 ID 经 TestingEntityIdStrategy 编码（"1" 解码入库，出参编码为 "T_1"），只断言非空，回显一致性在详情查询处验证
        expect(post.productId).toBeTruthy();
        expect(post.likeCount).toBe(0);
        expect(post.favoriteCount).toBe(0);
        expect(post.viewerLiked).toBe(false);
        expect(post.viewerFavorited).toBe(false);
        expect(post.isPinned).toBe(false);
        expect(post.nickname).toBeTruthy();

        const feed = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { items { id title images viewerLiked nickname } totalItems } }
        `) as any;
        expect(feed.circleFeed.totalItems).toBe(1);
        expect(feed.circleFeed.items[0].id).toBe(post.id);

        const detail = await shopClient.query(gql`
            query { circlePost(id: "${post.id}") { id title images nickname viewerLiked productId } }
        `) as any;
        expect(detail.circlePost.id).toBe(post.id);
        expect(detail.circlePost.productId).toBe(post.productId);
    });

    it('toggleLike：×1 liked=true count=1；×2 liked=false count=0（幂等往返）', async () => {
        const feed = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { items { id } totalItems } }
        `) as any;
        const postId = feed.circleFeed.items[0].id;

        const first = await shopClient.query(gql`
            mutation { toggleCircleLike(postId: "${postId}") { liked favorited likeCount favoriteCount } }
        `) as any;
        expect(first.toggleCircleLike.liked).toBe(true);
        expect(first.toggleCircleLike.likeCount).toBe(1);
        expect(first.toggleCircleLike.favorited).toBe(false);

        const feedAfter = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { items { id viewerLiked } totalItems } }
        `) as any;
        expect(feedAfter.circleFeed.items[0].viewerLiked).toBe(true);

        const second = await shopClient.query(gql`
            mutation { toggleCircleLike(postId: "${postId}") { liked favorited likeCount favoriteCount } }
        `) as any;
        expect(second.toggleCircleLike.liked).toBe(false);
        expect(second.toggleCircleLike.likeCount).toBe(0);

        const feedFinal = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { items { id viewerLiked } totalItems } }
        `) as any;
        expect(feedFinal.circleFeed.items[0].viewerLiked).toBe(false);
    });

    it('toggleFavorite：×1 favorited=true count=1；×2 favorited=false count=0（幂等往返）', async () => {
        const feed = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { items { id } totalItems } }
        `) as any;
        const postId = feed.circleFeed.items[0].id;

        const first = await shopClient.query(gql`
            mutation { toggleCircleFavorite(postId: "${postId}") { liked favorited likeCount favoriteCount } }
        `) as any;
        expect(first.toggleCircleFavorite.favorited).toBe(true);
        expect(first.toggleCircleFavorite.favoriteCount).toBe(1);
        expect(first.toggleCircleFavorite.liked).toBe(false);

        const second = await shopClient.query(gql`
            mutation { toggleCircleFavorite(postId: "${postId}") { liked favorited likeCount favoriteCount } }
        `) as any;
        expect(second.toggleCircleFavorite.favorited).toBe(false);
        expect(second.toggleCircleFavorite.favoriteCount).toBe(0);
    });

    it('myCirclePosts：作者自查可见', async () => {
        const mine = await shopClient.query(gql`
            query { myCirclePosts(options: { skip: 0, take: 10 }) { items { id title viewerLiked } totalItems } }
        `) as any;
        expect(mine.myCirclePosts.totalItems).toBe(1);
        expect(mine.myCirclePosts.items[0].title).toBe('开箱测评');
    });

    it('admin updateCirclePost hidden → feed 不再出现（admin 列表仍可见）；恢复 published + 置顶生效', async () => {
        const feed = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { items { id } totalItems } }
        `) as any;
        const postId = feed.circleFeed.items[0].id;

        const hidden = await adminClient.query(gql`
            mutation { updateCirclePost(input: { id: "${postId}", status: "hidden" }) { id status isPinned } }
        `) as any;
        expect(hidden.updateCirclePost.status).toBe('hidden');

        const feedAfter = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { totalItems } }
        `) as any;
        expect(feedAfter.circleFeed.totalItems).toBe(0);

        const adminList = await adminClient.query(gql`
            query { circlePosts(options: { skip: 0, take: 10 }) { items { id status isPinned } totalItems } }
        `) as any;
        expect(adminList.circlePosts.totalItems).toBe(1);
        expect(adminList.circlePosts.items[0].status).toBe('hidden');

        const restored = await adminClient.query(gql`
            mutation { updateCirclePost(input: { id: "${postId}", status: "published", isPinned: true }) { id status isPinned } }
        `) as any;
        expect(restored.updateCirclePost.status).toBe('published');
        expect(restored.updateCirclePost.isPinned).toBe(true);

        const feedRestored = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { items { id isPinned } totalItems } }
        `) as any;
        expect(feedRestored.circleFeed.totalItems).toBe(1);
        expect(feedRestored.circleFeed.items[0].isPinned).toBe(true);
    });

    it('未登录：游客可浏览 feed，但 createCirclePost 报错', async () => {
        await shopClient.asAnonymousUser();

        const guestFeed = await shopClient.query(gql`
            query { circleFeed(options: { skip: 0, take: 10 }) { items { id viewerLiked viewerFavorited } totalItems } }
        `) as any;
        expect(guestFeed.circleFeed.totalItems).toBe(1);
        expect(guestFeed.circleFeed.items[0].viewerLiked).toBe(false);
        expect(guestFeed.circleFeed.items[0].viewerFavorited).toBe(false);

        await expect(shopClient.query(gql`
            mutation { createCirclePost(input: { content: "匿名发帖" }) { id } }
        `)).rejects.toThrow();
    });
});
