"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusJianghuPlugin = void 0;
const core_1 = require("@vendure/core");
const graphql_tag_1 = __importDefault(require("graphql-tag"));
const jianghu_admin_resolver_1 = require("./jianghu-admin.resolver");
const jianghu_event_entity_1 = require("./jianghu-event.entity");
const jianghu_clue_entity_1 = require("./jianghu-clue.entity");
const jianghu_intel_entity_1 = require("./jianghu-intel.entity");
const jianghu_profile_entity_1 = require("./jianghu-profile.entity");
const jianghu_record_entity_1 = require("./jianghu-record.entity");
const jianghu_service_1 = require("./jianghu.service");
const jianghu_risk_service_1 = require("./jianghu-risk.service");
const jianghu_shop_resolver_1 = require("./jianghu-shop.resolver");
const jianghu_task_entity_1 = require("./jianghu-task.entity");
const permissions_1 = require("./permissions");
const schema_1 = require("./schema");
const options_1 = require("./options");
/**
 * campus-jianghu-plugin：校园江湖域（拾光传信者）。
 * 覆盖方向一（密信传递 P0）、方向二（情报阁 P1）的 Shop API 与运营后台 API。
 * 方向三（事件簿/剧本）复用 JianghuEvent 实体，后续扩展 resolver。
 */
let CampusJianghuPlugin = class CampusJianghuPlugin {
    /** 注入可选配置（如 Strapi 文案源）。未调用则使用默认（文案源关闭，前端回退内联文案）。 */
    static init(options) {
        Object.assign(options_1.jianghuOptions, options);
        return this;
    }
};
exports.CampusJianghuPlugin = CampusJianghuPlugin;
exports.CampusJianghuPlugin = CampusJianghuPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        compatibility: '^3.0.0',
        imports: [core_1.PluginCommonModule],
        entities: [jianghu_profile_entity_1.JianghuProfile, jianghu_task_entity_1.JianghuTask, jianghu_record_entity_1.JianghuRecord, jianghu_intel_entity_1.JianghuIntel, jianghu_event_entity_1.JianghuEvent, jianghu_clue_entity_1.JianghuClue],
        providers: [jianghu_service_1.JianghuService, jianghu_risk_service_1.JianghuRiskService],
        configuration: (config) => {
            var _a;
            // 关键：自定义权限必须注册进 authOptions.customPermissions 才会进入 GraphQL Permission 枚举，
            // 否则无法赋给任何角色，且 SuperAdmin 在本版本不会自动涵盖自定义权限，
            // 导致 jianghuCreateEvent / jianghuAuditClue 等 admin mutation 对任何管理员都不可达。
            config.authOptions.customPermissions = [
                ...((_a = config.authOptions.customPermissions) !== null && _a !== void 0 ? _a : []),
                permissions_1.CAMPUS_JIANGHU_PERMISSION,
            ];
            return config;
        },
        shopApiExtensions: {
            schema: (0, graphql_tag_1.default) `
            ${schema_1.JIANGHU_TYPES}
            ${schema_1.JIANGHU_SHOP_API}
        `,
            resolvers: [jianghu_shop_resolver_1.JianghuShopResolver],
        },
        adminApiExtensions: {
            schema: (0, graphql_tag_1.default) `
            ${schema_1.JIANGHU_TYPES}
            ${schema_1.JIANGHU_ADMIN_API}
        `,
            resolvers: [jianghu_admin_resolver_1.JianghuAdminResolver],
        },
    })
], CampusJianghuPlugin);
//# sourceMappingURL=campus-jianghu.plugin.js.map