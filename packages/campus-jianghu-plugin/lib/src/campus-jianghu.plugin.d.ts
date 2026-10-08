import { CampusJianghuOptions } from './options';
/**
 * campus-jianghu-plugin：校园江湖域（拾光传信者）。
 * 覆盖方向一（密信传递 P0）、方向二（情报阁 P1）的 Shop API 与运营后台 API。
 * 方向三（事件簿/剧本）复用 JianghuEvent 实体，后续扩展 resolver。
 */
export declare class CampusJianghuPlugin {
    /** 注入可选配置（如 Strapi 文案源）。未调用则使用默认（文案源关闭，前端回退内联文案）。 */
    static init(options: CampusJianghuOptions): typeof CampusJianghuPlugin;
}
