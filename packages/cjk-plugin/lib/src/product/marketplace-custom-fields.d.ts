import { CustomFields } from '@vendure/core';
/**
 * Product 级 marketplace 上架审批自定义字段。
 * 命名遵循 Vendure 规范：DB 列名 = customFields + 首字母大写字段名，
 * 例如 listedInMarketplace → customFieldsListedinmarketplace。
 * merchantRef 用 string 存 Channel id。
 */
export declare const marketplaceProductCustomFields: CustomFields;
