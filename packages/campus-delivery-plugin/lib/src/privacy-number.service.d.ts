import { RequestContext, TransactionalConnection } from '@vendure/core';
export interface PrivacyContact {
    /** 是否启用了号码保护（false 时 display 就是真实号） */
    protected: boolean;
    /** 展示用号码：脱敏号或虚拟号 */
    display: string | null;
    /** 可拨号码：虚拟号才有；null 表示不可拨（脱敏降级） */
    callable: string | null;
    provider: string;
    expiresAt: Date | null;
    /** 降级原因（provider 缺凭证等），前端可作提示 */
    note: string | null;
}
export interface PrivacySource {
    channelId: number | string;
    orderCode?: string | null;
    phone: string | null;
}
/**
 * 号码保护（P0）：商家/骑手/客服侧不直接拿顾客真实手机号。
 * Provider 抽象：
 * - mask：脱敏展示（零依赖，默认兜底）
 * - mock：本地虚拟号（演示用，不真实转接）
 * - aliyun / tencent：外部号池；缺凭证时运行时降级为 mask，绝不阻断订单流程
 */
export declare class PrivacyNumberService {
    private connection;
    /** mock 虚拟号池：同一渠道/订单/真实号在 TTL 内保持稳定 */
    private readonly mockPool;
    constructor(connection: TransactionalConnection);
    /** 手机号脱敏：11 位保留前 3 后 4，其它保留首尾 */
    mask(phone: string | null | undefined): string | null;
    /** 读取渠道隐私号配置（无配置行 = 未开启） */
    private getConfig;
    /**
     * 解析一个手机号在当前渠道下的展示方式。
     * 调用方：骑手任务联系人、商家工作台、客服台、运营侧工单。
     */
    resolve(ctx: RequestContext, source: PrivacySource): Promise<PrivacyContact>;
}
