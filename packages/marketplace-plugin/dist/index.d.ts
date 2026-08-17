export * from './plugin';
export * from './constants';
export * from './types';
export * from './marketplace.service';
export * from './marketplace-seller-service';
export * from './settlement.service';
declare module '@vendure/core/dist/entity/custom-entity-fields' {
    interface CustomOrderFields {
        saleSource: string;
    }
    interface CustomProductFields {
        listedInMarketplace: boolean;
        marketplaceStatus: string;
        rejectReason?: string | null;
        merchantRef?: import('@vendure/core').ID | null;
        barcode?: string | null;
        internalCode?: string | null;
    }
    interface CustomChannelFields {
        settlementBasis: string;
    }
    interface CustomSellerFields {
        marketplaceMerchant: boolean;
    }
}
