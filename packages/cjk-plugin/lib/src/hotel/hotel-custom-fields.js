"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hotelRoomCustomFields = void 0;
// 变体酒店房型配置 customFields：public 使店铺端查询可见
// 注：Vendure 3.6 无 json 自定义字段类型，用 text（longtext 列）存 JSON 字符串，
// 写入端 JSON.stringify、读取端 JSON.parse。
exports.hotelRoomCustomFields = {
    ProductVariant: [
        {
            name: 'hotelRoomConfig',
            type: 'text',
            public: true,
            nullable: true,
        },
    ],
};
//# sourceMappingURL=hotel-custom-fields.js.map