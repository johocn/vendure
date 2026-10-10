export interface ToggleFavoriteResult {
    favorited: boolean;
    favoriteCount: number;
}

export interface PointsProductListOptions {
    skip?: number;
    take?: number;
}

export interface PointsOrderListOptions {
    skip?: number;
    take?: number;
    status?: string;
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
}
