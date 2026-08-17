import { CustomFields } from '@vendure/core';
/**
 * 「本地电商就近服务」所需的四类自定义字段：
 * - Product ：归属城市 + 服务城市列表（前端按当前选城过滤/超区提示）
 * - StockLocation ：仓库/门店经纬度 + 服务城市列表（就近算法 + 超区门禁输入）
 * - Order ：下单时锁定的定位经纬度 + 服务城市 + 履约方式（就近分配输入）
 */
export declare const catalogCustomFields: CustomFields;
