"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusCustomFields = void 0;
exports.campusCustomFields = {
    Order: [
        { name: 'fulfillmentRoute', type: 'string', nullable: true }, // R1..R5
        { name: 'orderKind', type: 'string', nullable: true, defaultValue: 'normal' },
        { name: 'buildingId', type: 'string', nullable: true },
        { name: 'campusZone', type: 'string', nullable: true },
        { name: 'hallStatus', type: 'string', nullable: true }, // open/grabbed
        { name: 'hallEnteredAt', type: 'datetime', nullable: true },
        { name: 'riderEarning', type: 'int', nullable: true },
        { name: 'tip', type: 'int', nullable: true },
        { name: 'deliverySlotId', type: 'string', nullable: true }, // ID 存 string，与 customFields 类型系统一致
        { name: 'deliverySlotText', type: 'string', nullable: true }, // '2026-10-06 11:00-11:30'
        { name: 'errandKind', type: 'string', nullable: true }, // pickup_express / bring_food / buy / other
        { name: 'errandFrom', type: 'string', nullable: true },
        { name: 'errandTo', type: 'string', nullable: true },
        { name: 'errandNote', type: 'string', nullable: true }, // 跑腿物品描述/要求
        { name: 'leg1Status', type: 'string', nullable: true }, // R2: preparing / arrived_gate
        { name: 'handoverAt', type: 'datetime', nullable: true }, // R2 到校时间
        { name: 'campusCause', type: 'string', nullable: true }, // 对账标记: slot_full / no_rider
        { name: 'transferPhotos', type: 'string', list: true, nullable: true }, // 已取货转单拍照交接存证
        { name: 'transferNote', type: 'string', nullable: true },
        { name: 'transferAt', type: 'datetime', nullable: true },
        { name: 'riderLat', type: 'float', nullable: true }, // 骑手实时位置（gcj02），仅配送中写入，送达/转单清除
        { name: 'riderLng', type: 'float', nullable: true },
        { name: 'urged', type: 'boolean', nullable: true, defaultValue: false }, // 用户催单标记（plan 2.4）
        { name: 'urgedAt', type: 'datetime', nullable: true }, // 最近一次催单时间，10min 内禁止重复催
    ],
    Channel: [
        { name: 'waimaiTags', type: 'string', nullable: true }, // '米饭快餐,夜宵' 逗号分隔
        { name: 'waimaiMonthlySales', type: 'int', nullable: true },
        { name: 'waimaiLogo', type: 'string', nullable: true },
        { name: 'waimaiPromoText', type: 'string', nullable: true }, // 满减 tag 文案，如 '满20减4'（spec §12.2 增补）
    ],
    Customer: [
        { name: 'riderStatus', type: 'string', nullable: true }, // none/pending/approved/suspended
        { name: 'riderRealName', type: 'string', nullable: true },
        { name: 'riderStudentNo', type: 'string', nullable: true },
        { name: 'riderCampus', type: 'string', nullable: true },
        { name: 'riderIdImg', type: 'string', nullable: true },
        { name: 'riderCredit', type: 'int', nullable: true, defaultValue: 100 },
        { name: 'riderOnlineAt', type: 'datetime', nullable: true }, // 心跳时间戳，「在线」= approved && 5min 内有心跳
    ],
};
//# sourceMappingURL=custom-fields.js.map