import { ID } from '@vendure/core';

export type ShopStatus = 'applicant' | 'active' | 'closed';

/** 店铺级评分聚合（实时口径），对外展示用。 */
export interface ShopRating {
    rating: number;
    reviewCount: number;
    productCount: number;
}

export interface CreateShopInput {
    name: string;
    slug: string;
    logoAssetId?: ID;
    bannerAssetId?: ID;
    description?: string;
}

export interface UpdateShopInput {
    name?: string;
    slug?: string;
    logoAssetId?: ID;
    bannerAssetId?: ID;
    description?: string;
}

export interface AssignProductsInput {
    shopId: ID;
    productIds: ID[];
}

export interface ShopListOptions {
    skip?: number;
    take?: number;
}

export interface ShopPluginOptions {}