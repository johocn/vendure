import { FulfillmentHandler, LanguageCode } from '@vendure/core';
export declare const storePickupFulfillmentHandler: FulfillmentHandler<{
    storeId: {
        type: "string";
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        })[];
    };
    storeName: {
        type: "string";
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        })[];
    };
}>;
export declare const pickupPointFulfillmentHandler: FulfillmentHandler<{
    pointId: {
        type: "string";
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        })[];
    };
    pointName: {
        type: "string";
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        })[];
    };
    pointAddress: {
        type: "string";
        label: ({
            languageCode: LanguageCode.zh_Hans;
            value: string;
        } | {
            languageCode: LanguageCode.en;
            value: string;
        })[];
    };
}>;
export declare const employeePickupFulfillmentHandler: FulfillmentHandler<{}>;
