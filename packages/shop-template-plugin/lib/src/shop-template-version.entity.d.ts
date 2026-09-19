import { VendureEntity } from '@vendure/core';
export declare class ShopTemplateVersion extends VendureEntity {
    constructor(input?: Partial<ShopTemplateVersion>);
    templateId: number;
    version: number;
    name?: string | null;
    theme?: any;
    pages?: any;
    enabled: boolean;
    note?: string | null;
}
