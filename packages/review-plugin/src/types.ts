import { ID, ListQueryOptions } from '@vendure/core';

import { Review } from './review.entity';

export interface ReviewPluginOptions {}

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
