import { CustomFields } from '@vendure/core';
/**
 * 阶段19自定义字段。
 * - Product.favoriteCount：商品收藏数快照（int, nullable, public），供列表卡片直接展示。
 *   由 service 在 toggle 后实时 count 写回（对齐 review 评分快照口径）。
 * - 店铺关注数为动态 count，不写 Shop 缓存列（避免跨插件实体联动）。
 */
export declare const favoriteCustomFields: CustomFields;
