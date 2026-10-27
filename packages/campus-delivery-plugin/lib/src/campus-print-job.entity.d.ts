import { DeepPartial, ID, VendureEntity } from '@vendure/core';
/** 云打印任务留痕（P1-4）：一单一任务，失败可在后台看原因并重打 */
export declare class CampusPrintJob extends VendureEntity {
    [key: string]: any;
    /** 关联订单（测试打印为 null） */
    orderId: ID | null;
    channelId: ID;
    /** 打印通道：feie=飞鹅 / yilianyun=易联云 */
    provider: string;
    deviceSn: string | null;
    /** ok / failed */
    status: string;
    /** auto=自动出票 / manual=手动补打 / test=测试打印 */
    triggerType: string;
    copies: number;
    /** 服务商返回的「模拟」结果（未配置真实设备时不触达网络） */
    dryRun: boolean;
    errorMessage: string | null;
    durationMs: number | null;
    /** 小票正文（排障/重发用） */
    content: string | null;
    constructor(input?: DeepPartial<CampusPrintJob>);
}
