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

// ---------- 阶段18 店主自营后台 ----------

export interface CreateOwnerInput {
    emailAddress: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

export interface UpdateMyShopInput {
    name?: string;
    description?: string;
    logoAssetId?: ID;
    bannerAssetId?: ID;
}

export interface UpdateMyShopProductInput {
    name?: string;
    description?: string;
}

export interface MerchantOrderLine {
    orderLineId: string;
    productId: string;
    productName: string;
    variantName: string;
    quantity: number;
    unitPriceWithTax: number;
    lineTotalWithTax: number;
}

export interface MerchantOrder {
    orderId: string;
    code: string;
    state: string;
    totalWithTax: number;
    currencyCode: string;
    customerName: string | null;
    placedAt: Date | null;
    items: MerchantOrderLine[];
}

export interface MerchantReview {
    reviewId: string;
    productId: string;
    productName: string;
    rating: number;
    content: string;
    status: string;
    customerName: string | null;
    createdAt: Date;
}