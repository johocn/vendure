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
    /** 该行已履约（非 Cancelled FulfillmentLine 求和）数量。 */
    fulfilledQuantity: number;
    unitPriceWithTax: number;
    lineTotalWithTax: number;
}

export interface MerchantFulfillmentLine {
    orderLineId: string;
    productName: string;
    variantName: string;
    quantity: number;
}

export interface MerchantFulfillment {
    fulfillmentId: string;
    state: string;
    method: string | null;
    trackingCode: string | null;
    createdAt: Date;
    items: MerchantFulfillmentLine[];
}

export interface FulfillLineInput {
    orderLineId: ID;
    quantity: number;
}

export interface FulfillMyShopOrderResult {
    orderId: string;
    totalItemCount: number;
    shippedItemCount: number;
    remainingItemCount: number;
    fulfillmentIds: string[];
}

export interface MerchantShippingAddress {
    fullName: string | null;
    streetLine1: string | null;
    city: string | null;
    province: string | null;
    countryCode: string | null;
    postalCode: string | null;
}

export interface MerchantShippingLine {
    id: string;
    code: string | null;
    name: string | null;
}

export interface MerchantOrder {
    orderId: string;
    code: string;
    state: string;
    totalWithTax: number;
    currencyCode: string;
    customerName: string | null;
    placedAt: Date | null;
    shippingAddress: MerchantShippingAddress | null;
    shippingLines: MerchantShippingLine[];
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