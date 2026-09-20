export type EcoAction = 'view_product' | 'view_price' | 'purchase' | 'distribute';
export interface EcoPluginOptions {
    /**
     * 游戏服务器基础地址（如 https://game.joho.cn），内部拼接 /api/client/v1/eco/events。
     * 缺省回退环境变量 GAME_ECO_URL。
     */
    gameUrl?: string;
    /**
     * 生态事件共享密钥（与游戏服务器 ECO_SHARED_SECRET 一致）。
     * 缺省回退环境变量 GAME_ECO_SECRET。
     */
    secret?: string;
    /** 生态域 scope，默认 youshop */
    scope?: string;
    /** 上报 HTTP 超时毫秒，默认 2000 */
    timeoutMs?: number;
}
