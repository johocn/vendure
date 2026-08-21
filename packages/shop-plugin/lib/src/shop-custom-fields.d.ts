import { CustomFields } from '@vendure/core';
/**
 * 阶段17自定义字段。
 * - Product.shopId：走 core 支持的 Product 自定义字段路径，显式记录商品归属店铺。
 * - Shop 缓存评分不放 customFields——Shop 是插件自研实体，缓存直接作为实体普通列（见 shop.entity.ts）。
 */
export declare const shopCustomFields: CustomFields;
