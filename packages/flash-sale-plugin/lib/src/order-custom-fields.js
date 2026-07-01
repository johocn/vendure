"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flashSaleOrderCustomFields = void 0;
const core_1 = require("@vendure/core");
exports.flashSaleOrderCustomFields = {
    Order: [
        { name: 'flashSaleActivityId', type: 'int', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '秒杀活动ID' }] },
        { name: 'flashSaleStartAt', type: 'datetime', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '秒杀开始时间' }] },
        { name: 'flashSaleEndAt', type: 'datetime', nullable: true, label: [{ languageCode: core_1.LanguageCode.zh_Hans, value: '秒杀结束时间' }] },
    ],
};
//# sourceMappingURL=order-custom-fields.js.map