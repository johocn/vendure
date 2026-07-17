"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CARRIERS = void 0;
exports.getCarrierByCode = getCarrierByCode;
exports.CARRIERS = [
    { code: 'SF', name: '顺丰速运', shortName: '顺丰', sort: 1 },
    { code: 'ZTO', name: '中通快递', shortName: '中通', sort: 2 },
    { code: 'YTO', name: '圆通速递', shortName: '圆通', sort: 3 },
    { code: 'STO', name: '申通快递', shortName: '申通', sort: 4 },
    { code: 'YD', name: '韵达快递', shortName: '韵达', sort: 5 },
    { code: 'JD', name: '京东物流', shortName: '京东', sort: 6 },
    { code: 'JT', name: '极兔速递', shortName: '极兔', sort: 7 },
    { code: 'EMS', name: 'EMS', shortName: 'EMS', sort: 8 },
    { code: 'DBL', name: '德邦快递', shortName: '德邦', sort: 9 },
    { code: 'HT', name: '百世快递', shortName: '百世', sort: 10 },
];
function getCarrierByCode(code) {
    return exports.CARRIERS.find(c => c.code === code);
}
//# sourceMappingURL=carrier-dictionary.js.map