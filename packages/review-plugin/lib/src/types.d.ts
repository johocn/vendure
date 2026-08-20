import { ID, ListQueryOptions } from '@vendure/core';
import { Review } from './review.entity';
export interface ReviewPluginOptions {
    /** 评价内容去除首尾空白后的最小长度，用于屏蔽刷评/空白灌水。默认 0。 */
    minContentLength?: number;
    /** 开启后用户创建的评价直接 approved 并立即计入商品评分聚合（默认 false，走 pending→approve 审核流）。 */
    autoApprove?: boolean;
}
export interface CreateReviewInput {
    productId: ID;
    orderLineId?: ID;
    variantId?: ID;
    rating: number;
    content: string;
    images?: string[];
    videos?: string[];
    tags?: string[];
    isAnonymous?: boolean;
}
export interface UpdateReviewInput {
    content?: string;
    rating?: number;
    images?: string[];
    videos?: string[];
    tags?: string[];
    isAnonymous?: boolean;
}
/** 追评：挂在主评下，可仅文字/图片，聚合不计入。 */
export interface FollowUpReviewInput {
    content?: string;
    rating?: number;
    images?: string[];
    videos?: string[];
    tags?: string[];
    isAnonymous?: boolean;
}
export interface ReviewListOptions extends ListQueryOptions<Review> {
    productId?: ID;
    status?: string;
}
export interface RatingCount {
    rating: number;
    count: number;
}
export interface TagCount {
    tag: string;
    count: number;
}
export interface ReviewStats {
    totalCount: number;
    goodRate: number;
    averageRating: number;
    ratingDistribution: RatingCount[];
    topTags: TagCount[];
}
/** 聚合到 Product.customFields 的评分快照，供列表卡片直接展示。 */
export interface ProductRating {
    rating: number;
    reviewCount: number;
}
