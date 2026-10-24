/** 单个飞书群的授权与渠道绑定（FEISHU_CHAT_MAP 的一项） */
export interface FeishuChatConfig {
    /** Vendure 渠道 token（canteen-a-token 等），决定指令操作哪个店铺 */
    channel: string;
    /** 普通指令白名单（帮助/待处理/接单/出餐/今日汇总） */
    operators: string[];
    /** 高危指令白名单（拒单/关店/开店），通常只给店主 */
    owners: string[];
}
export interface FeishuSettings {
    enabled: boolean;
    webhook?: string;
    secret?: string;
    appId?: string;
    appSecret?: string;
    verifyToken?: string;
    encryptKey?: string;
    chats: Record<string, FeishuChatConfig>;
    /** 每日汇总时间 HH:mm（UTC+8） */
    digestAt: string;
}
/** 解析 FEISHU_CHAT_MAP（坏 JSON 只告警并退回空表，绝不抛错） */
export declare function parseChatMap(raw: string | undefined): Record<string, FeishuChatConfig>;
export declare function readFeishuSettings(env?: NodeJS.ProcessEnv): FeishuSettings;
export declare class FeishuConfigService {
    readonly settings: FeishuSettings;
    constructor();
    get enabled(): boolean;
    chatOf(chatId: string): FeishuChatConfig | undefined;
}
