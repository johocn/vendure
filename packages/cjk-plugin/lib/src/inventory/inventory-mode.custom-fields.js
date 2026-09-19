"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryModeChannelFields = void 0;
// 渠道自定义字段：库存管理模式开关（simple|odoo）+ Odoo 对接参数。
// 供 plugin.ts 合并进 Channel customFields。
exports.inventoryModeChannelFields = [
    {
        name: 'inventoryMode',
        type: 'string',
        list: false,
        defaultValue: 'simple',
        nullable: true,
        ui: {
            component: 'select',
            options: [
                { value: 'simple', label: '简单库存' },
                { value: 'odoo', label: 'Odoo库存(预留)' },
            ],
        },
    },
    { name: 'odooBaseUrl', type: 'string', nullable: true },
    { name: 'odooApiKey', type: 'string', nullable: true },
];
//# sourceMappingURL=inventory-mode.custom-fields.js.map