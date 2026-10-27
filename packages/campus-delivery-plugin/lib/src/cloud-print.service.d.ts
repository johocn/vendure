import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
import { HallService } from './hall.service';
import { PRINT_PROVIDERS } from './waimai-store.service';
export type PrintProvider = (typeof PRINT_PROVIDERS)[number];
export interface CloudPrintResult {
    ok: boolean;
    provider: string;
    dryRun: boolean;
    jobId: string | null;
    error: string | null;
}
export interface CloudPrintJobRow {
    id: string;
    orderId: string | null;
    orderCode: string | null;
    provider: string;
    deviceSn: string | null;
    status: string;
    triggerType: string;
    copies: number;
    dryRun: boolean;
    errorMessage: string | null;
    durationMs: number | null;
    createdAt: Date;
}
interface TicketLine {
    name: string;
    quantity: number;
    price: number;
    addons: string[];
}
interface TicketData {
    storeName: string;
    storePhone: string | null;
    code: string;
    createdAtText: string;
    zone: string;
    building: string;
    slotText: string;
    route: string;
    note: string | null;
    lines: TicketLine[];
    subtotal: number;
    shipping: number;
    total: number;
    title?: string;
}
/** 58mm 纯文本小票（服务商按 <BR> 换行） */
export declare function buildTicketContent(d: TicketData): string;
export declare class CloudPrintService {
    private connection;
    private config;
    private hall;
    /** 易联云 access_token 缓存（按 client_id），提前 5 分钟过期重取 */
    private ylyTokens;
    constructor(connection: TransactionalConnection, config: CampusConfigService, hall: HallService);
    /** 云打印一张订单小票：失败不抛给调用方（自动触发时不能因打印机故障卡住接单） */
    printOrder(ctx: RequestContext, orderId: ID, trigger: 'auto' | 'manual'): Promise<CloudPrintResult>;
    /** 测试打印：不绑定订单，仅验证账号/设备/签名是否可用 */
    testPrint(ctx: RequestContext): Promise<CloudPrintResult>;
    /** 最近打印任务（后台排障：失败原因、耗时、是否模拟） */
    recentJobs(ctx: RequestContext, limit?: number): Promise<CloudPrintJobRow[]>;
    /** 统一落任务 + 调服务商：任何异常都收敛为任务失败，不向上抛错 */
    private dispatch;
    /** 飞鹅云：Open_printMsg（sig=SHA1(user+ukey+stime)） */
    private sendFeie;
    /** 易联云：oauth 取 token → print/index（sign=MD5(client_id+timestamp+client_secret)） */
    private sendYilianyun;
    private yilianToken;
    /** 带超时的表单 POST：服务商接口不可用时最多阻塞 8s，避免拖慢接单 */
    private postForm;
}
export {};
