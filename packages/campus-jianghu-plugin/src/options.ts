/**
 * 校园江湖插件可选配置。
 * - contentApi：江湖事件文案（标题/背景/奖励文案/横幅）的 Strapi 内容源。
 *   运营在 h.joho.cn 可视化编辑并上架「江湖事件文案」，前端拉取后覆盖实体内联文案，
 *   无需发版即可改文案。未配置或不可达时优雅返回 null，前端回退到实体字段。
 */
export interface CampusJianghuContentApi {
    /** Strapi 基地址，如 https://h.joho.cn（铁律：Strapi 后端=h.joho.cn，非 api.yourbao.cn） */
    baseUrl?: string;
    /** Strapi API Token（只读即可） */
    token?: string;
    /** 集合类型名，默认 jianghu-event-copies */
    collection?: string;
}

export interface CampusJianghuOptions {
    contentApi?: CampusJianghuContentApi;
}

/** 由 CampusJianghuPlugin.init() 填充，运行时供 service 读取 */
export const jianghuOptions: CampusJianghuOptions = {};
