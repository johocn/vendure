import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import gql from 'graphql-tag';
import { JianghuAdminResolver } from './jianghu-admin.resolver';
import { JianghuEvent } from './jianghu-event.entity';
import { JianghuClue } from './jianghu-clue.entity';
import { JianghuIntel } from './jianghu-intel.entity';
import { JianghuProfile } from './jianghu-profile.entity';
import { JianghuRecord } from './jianghu-record.entity';
import { JianghuService } from './jianghu.service';
import { JianghuRiskService } from './jianghu-risk.service';
import { JianghuShopResolver } from './jianghu-shop.resolver';
import { JianghuTask } from './jianghu-task.entity';
import { CAMPUS_JIANGHU_PERMISSION } from './permissions';
import { JIANGHU_ADMIN_API, JIANGHU_SHOP_API, JIANGHU_TYPES } from './schema';
import { jianghuOptions, CampusJianghuOptions } from './options';

/**
 * campus-jianghu-plugin：校园江湖域（拾光传信者）。
 * 覆盖方向一（密信传递 P0）、方向二（情报阁 P1）的 Shop API 与运营后台 API。
 * 方向三（事件簿/剧本）复用 JianghuEvent 实体，后续扩展 resolver。
 */
@VendurePlugin({
    compatibility: '^3.0.0',
    imports: [PluginCommonModule],
    entities: [JianghuProfile, JianghuTask, JianghuRecord, JianghuIntel, JianghuEvent, JianghuClue],
    providers: [JianghuService, JianghuRiskService],
    configuration: (config) => {
        // 关键：自定义权限必须注册进 authOptions.customPermissions 才会进入 GraphQL Permission 枚举，
        // 否则无法赋给任何角色，且 SuperAdmin 在本版本不会自动涵盖自定义权限，
        // 导致 jianghuCreateEvent / jianghuAuditClue 等 admin mutation 对任何管理员都不可达。
        config.authOptions.customPermissions = [
            ...(config.authOptions.customPermissions ?? []),
            CAMPUS_JIANGHU_PERMISSION,
        ];
        return config;
    },
    shopApiExtensions: {
        schema: gql`
            ${JIANGHU_TYPES}
            ${JIANGHU_SHOP_API}
        `,
        resolvers: [JianghuShopResolver],
    },
    adminApiExtensions: {
        schema: gql`
            ${JIANGHU_TYPES}
            ${JIANGHU_ADMIN_API}
        `,
        resolvers: [JianghuAdminResolver],
    },
})
export class CampusJianghuPlugin {
    /** 注入可选配置（如 Strapi 文案源）。未调用则使用默认（文案源关闭，前端回退内联文案）。 */
    static init(options: CampusJianghuOptions) {
        Object.assign(jianghuOptions, options);
        return this;
    }
}
