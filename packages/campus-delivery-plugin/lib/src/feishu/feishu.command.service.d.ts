import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { CampusDedupeService } from '../campus-dedupe.service';
import { DeliveryStatsService } from '../delivery-stats.service';
import { DispatchAdminService } from '../dispatch-admin.service';
import { HallService } from '../hall.service';
import { MerchantAdminService } from '../merchant-admin.service';
import { RiderTaskService } from '../rider-task.service';
import { FeishuCardService } from './feishu-card.service';
import { FeishuClient } from './feishu.client';
import { FeishuChatConfig, FeishuConfigService } from './feishu.config';
export type FeishuCommandName = 'help' | 'board' | 'digest' | 'status' | 'exceptions' | 'accept' | 'cooking' | 'handover' | 'resendHandover' | 'reject' | 'confirmReject' | 'reassign' | 'handled' | 'restore' | 'confirmRestore' | 'close' | 'open' | 'unknown';
export interface ParsedCommand {
    name: FeishuCommandName;
    orderCode?: string;
    reason?: string;
    /** 关店/开店的目标店铺（平台管理群必填） */
    store?: string;
    /** 卡片按钮原始 action 值（refund_diff/coupon/refund_all 等），用于审计日志 */
    cardAction?: string;
}
/** 去掉 @ 占位符与首尾空白，再按首个空格切命令与参数（纯函数，便于单测） */
export declare function parseCommand(raw: string): ParsedCommand;
/** 指令所需权限等级：operator=查询/接单/出餐；owner=拒单/开关店 */
export declare function requiredRole(cmd: FeishuCommandName): 'none' | 'operator' | 'owner';
/** Bug 9 回归测试入口：confirmRestore 的 UPDATE SQL 纯函数，spec 可直接断言不含幽灵列
 * 历史 bug: 曾硬写 customFieldsExceptionfinal=FLASE——custom-fields.ts 无此定义，恢复功能完全不可用
 * PG 列名必须双引号：本 fork 物理列是 customFields 前缀带大写（customFieldsHallstatus），
 * 裸写会被 PG 折叠成小写 → column does not exist（SQLite 单测不暴露，生产直接报错） */
export declare function buildRestoreSQL(): {
    sql: string;
    fields: string[];
};
/** audit 日志建表 SQL：CREATE TABLE IF NOT EXISTS 零 migration，首次 audit 时触发 */
export declare const AUDIT_TABLE_SQL = "\nCREATE TABLE IF NOT EXISTS feishu_audit_log (\n    id bigserial PRIMARY KEY,\n    ts timestamptz NOT NULL DEFAULT now(),\n    chat_id text,\n    open_id text,\n    cmd_name text,\n    card_action text,\n    order_code text,\n    result text\n)";
/**
 * 飞书群指令：解析 → 权限校验 → 调商家工作台服务 → 回复结果。
 * 群定位：
 * - channel：店铺群，看板/汇总/写操作都限定绑定的店铺；
 * - platform：平台管理群，看板/异常/汇总跨全部店铺，写操作按单号/店铺参数指定。
 * 鉴权：chat_id 白名单（FEISHU_CHAT_MAP）+ open_id 分 operators / owners 两级；
 * 所有操作记审计日志，回复里不出现顾客手机号/详细地址。
 */
export declare class FeishuCommandService {
    private cfg;
    private client;
    private cards;
    private requestContextService;
    private connection;
    private merchant;
    private dispatchAdmin;
    private deliveryStats;
    private hall;
    private riderTask;
    /** M4 跨实例限流/待确认状态（多实例下同一指令不会在多个进程各自放行）；未注入退回进程内 Map */
    private dedupe?;
    private rate;
    private pendingReject;
    private pendingRestore;
    /** audit 表建表单飞 Promise（零 migration，首次写库时自动建表） */
    private auditReady?;
    constructor(cfg: FeishuConfigService, client: FeishuClient, cards: FeishuCardService, requestContextService: RequestContextService, connection: TransactionalConnection, merchant: MerchantAdminService, dispatchAdmin: DispatchAdminService, deliveryStats: DeliveryStatsService, hall: HallService, riderTask: RiderTaskService, 
    /** M4 跨实例限流/待确认状态（多实例下同一指令不会在多个进程各自放行）；未注入退回进程内 Map */
    dedupe?: CampusDedupeService | undefined);
    handleMessage(input: {
        chatId: string;
        openId: string;
        text: string;
        /** 被引用消息（im.message.receive_v1 的 parent_id） */
        parentId?: string;
        /** 话题根消息（root_id），parent 是普通文本时兜底 */
        rootId?: string;
    }): Promise<void>;
    /** 卡片按钮回调（card.action.trigger）：全部走同一条通道，不落库 */
    handleCardAction(input: {
        chatId: string;
        openId: string;
        value?: any;
        messageId?: string;
    }): Promise<void>;
    renderBoard(chat: FeishuChatConfig): Promise<string>;
    renderDigest(chat: FeishuChatConfig): Promise<string>;
    renderExceptions(chat: FeishuChatConfig): Promise<string>;
    private platformBoardText;
    private platformDigestText;
    private channelBoardText;
    private status;
    statusText(code: string): Promise<string>;
    private findExactOrder;
    /** 模糊检索：近 7 天订单按完整单号/尾号/楼栋匹配（最多 5 条），纯读、不建索引 */
    private searchOrders;
    /** 允许用尾号/楼栋操作：唯一命中才放行，多命中发候选卡片 */
    private resolveOrderCode;
    /** 引用消息 → 完整单号（卡片读按钮 value，文本读最长字母数字串） */
    private quotedCodeOf;
    private codeFromMessage;
    private collectIssues;
    /** 即将超时（提前告警窗口内但还没真超阈值） */
    private soonOverdueOf;
    /** 各环节超时判定（与调度兜底阈值保持一致，仅用于群里提示，不做任何改单） */
    private overdueOf;
    private accept;
    private cooking;
    /** R1 商户/自营快递送达校园交接点：按当前履约阶段分流（无需商户进后台点按钮） */
    private handover;
    /** R5 交接码重发：仅待交接（hallStatus=open）订单可重发；同单 10 分钟限流。 */
    private resendHandover;
    /** 拒单第一步：只登记待确认，不执行任何退款/取消 */
    private stageReject;
    private confirmReject;
    /** stageRestore：二次确认模式，避免误操作恢复 exception_final 单 */
    private stageRestore;
    private confirmRestore;
    private setPaused;
    private requireOrder;
    private channelTargets;
    private ctxForToken;
    private cancelledCount;
    private exceptionCount;
    private isOperator;
    private isOwner;
    private isRateLimited;
    /** 安全 GC：数组收集 key + 遍历完统一 delete（避免 Bug 5 模式——遍历时 delete 跳元素） */
    private cleanupConfirmations;
    private reply;
    /** 优先回在订单话题里（引用卡片/线程），拿不到锚点消息时退回群消息 */
    private replyInThread;
    private audit;
}
