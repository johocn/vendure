"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const custom_fields_1 = require("./custom-fields");
(0, vitest_1.describe)('campusCustomFields', () => {
    (0, vitest_1.it)('Channel 含 waimai 四字段（tags/monthlySales/logo/promoText）', () => {
        var _a;
        const names = ((_a = custom_fields_1.campusCustomFields.Channel) !== null && _a !== void 0 ? _a : []).map(f => f.name);
        (0, vitest_1.expect)(names).toContain('waimaiTags');
        (0, vitest_1.expect)(names).toContain('waimaiMonthlySales');
        (0, vitest_1.expect)(names).toContain('waimaiLogo');
        (0, vitest_1.expect)(names).toContain('waimaiPromoText');
    });
    (0, vitest_1.it)('Order 含转单存证字段', () => {
        var _a;
        const names = ((_a = custom_fields_1.campusCustomFields.Order) !== null && _a !== void 0 ? _a : []).map(f => f.name);
        (0, vitest_1.expect)(names).toContain('transferPhotos');
        (0, vitest_1.expect)(names).toContain('transferNote');
        (0, vitest_1.expect)(names).toContain('transferAt');
    });
});
//# sourceMappingURL=custom-fields.spec.js.map