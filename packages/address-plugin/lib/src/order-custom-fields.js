"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressOrderCustomFields = void 0;
/**
 * 阶段22 · 订单侧收件区划码/经纬度（结算运费联动 + 按店可达性校验的取值来源）。
 * baseFee/freeThreshold 由 admin 通过 upSertDeliveryRange 维护在 DeliveryRange 上。
 */
exports.addressOrderCustomFields = [
    { name: 'shippingProvinceCode', type: 'string', nullable: true },
    { name: 'shippingCityCode', type: 'string', nullable: true },
    { name: 'shippingDistrictCode', type: 'string', nullable: true },
    { name: 'shippingLng', type: 'float', nullable: true },
    { name: 'shippingLat', type: 'float', nullable: true },
];
//# sourceMappingURL=order-custom-fields.js.map