export interface ToggleFavoriteResult {
    favorited: boolean;
    favoriteCount: number;
}

export interface PointsMallPluginOptions {
    /** 待支付积分订单超时自动关单分钟数，默认 30；设 0 关闭自动关单 */
    pointsOrderTimeoutMinutes?: number;
}

export interface PointsProductListOptions {
    skip?: number;
    take?: number;
    keyword?: string;
}

export interface PointsOrderListOptions {
    skip?: number;
    take?: number;
    status?: string;
    keyword?: string;
}

export interface CreatePointsProductInput {
    productId: string;
    variantId: string;
    pointsPrice: number;
    cashPrice?: number;
    deliveryType: string;
    stock: number;
    perUserLimit?: number;
    validFrom?: Date | null;
    validTo?: Date | null;
    status?: string;
    sortOrder?: number;
}

export interface UpdatePointsProductInput extends Partial<CreatePointsProductInput> {
    id: string;
}

export interface CreatePointsOrderInput {
    pointsProductId: string;
    quantity: number;
    addressId?: string;
}

export interface PointsPayParams {
    pointsOrderId: string;
    outTradeNo: string;
    pay: any;
}

export interface FavoriteProductView {
    productId: string;
    name: string;
    slug: string;
    image: string | null;
    priceWithTax: number;
    isOnSale: boolean;
    pointsPrice: number | null;
    favoritedAt: Date;
}

export interface PointsProductView {
    [k: string]: any;
    myRedeemedCount: number;
}
