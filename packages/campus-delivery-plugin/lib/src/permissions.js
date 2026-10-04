"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campusPermissionDefinitions = exports.CampusPermissions = void 0;
const core_1 = require("@vendure/core");
exports.CampusPermissions = {
    CampusConfig: 'CampusConfig', // 分区/宿舍楼/履约配置
    CampusAuditRider: 'CampusAuditRider', // 骑手审核
    CampusViewDispatch: 'CampusViewDispatch', // 调度看板
};
exports.campusPermissionDefinitions = [
    { name: 'CampusConfig', description: '校园履约配置' },
    { name: 'CampusAuditRider', description: '骑手招募审核' },
    { name: 'CampusViewDispatch', description: '配送调度看板' },
].map(p => new core_1.PermissionDefinition(p));
//# sourceMappingURL=permissions.js.map