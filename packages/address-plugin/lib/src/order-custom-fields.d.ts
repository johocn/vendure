import { CustomFields } from '@vendure/core';
/**
 * 阶段22 · 订单侧收件区划码/经纬度（结算运费联动 + 按店可达性校验的取值来源）。
 * baseFee/freeThreshold 由 admin 通过 upSertDeliveryRange 维护在 DeliveryRange 上。
 */
export declare const addressOrderCustomFields: NonNullable<CustomFields['Order']>;
