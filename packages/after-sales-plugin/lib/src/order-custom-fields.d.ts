import { LanguageCode } from '@vendure/core';
export declare const afterSalesOrderCustomFields: {
    Order: {
        name: string;
        type: "string";
        nullable: boolean;
        label: {
            languageCode: LanguageCode;
            value: string;
        }[];
    }[];
};
