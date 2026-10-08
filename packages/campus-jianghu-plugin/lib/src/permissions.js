"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAMPUS_JIANGHU_PERMISSION = void 0;
const core_1 = require("@vendure/core");
/** 江湖域运营权限：审核情报、发布密信、处罚传信者 */
exports.CAMPUS_JIANGHU_PERMISSION = new core_1.PermissionDefinition({
    name: 'CampusJianghu',
    description: '管理江湖域（密信/情报/段位/处罚）',
    internal: false,
});
//# sourceMappingURL=permissions.js.map