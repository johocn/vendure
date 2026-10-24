import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { DeliveryStatsService } from '../delivery-stats.service';
import { MerchantAdminService } from '../merchant-admin.service';
import { FeishuClient } from './feishu.client';
import { FeishuConfigService } from './feishu.config';
export type FeishuCommandName = 'help' | 'board' | 'accept' | 'cooking' | 'reject' | 'confirmReject' | 'close' | 'open' | 'digest' | 'unknown';
export interface ParsedCommand {
    name: FeishuCommandName;
    orderCode?: string;
    reason?: string;
}
/** 去掉 @ 占位符与首尾空白，再按首个空格切命令与参数（纯函数，便于单测） */
export declare function parseCommand(raw: string): ParsedCommand;
/** 指令所需权限等级：operator=接单/出餐/看板；owner=拒单/开关店 */
export declare function requiredRole(cmd: FeishuCommandName): 'none' | 'operator' | 'owner';
/**
 * 飞书群指令：解析 → 权限校验 → 调商家工作台服务 → 回复结果。
 * 鉴权模型：chat_id 绑定渠道（FEISHU_CHAT_MAP），open_id 分 operators / owners 两级白名单；
 * 所有操作记审计日志，回复里不出现顾客手机号/详细地址。
 */
export declare class FeishuCommandService {
    private cfg;
    private client;
    private requestContextService;
    private connection;
    private merchant;
    private deliveryStats;
    private rate;
    private pendingReject;
    constructor(cfg: FeishuConfigService, client: FeishuClient, requestContextService: RequestContextService, connection: TransactionalConnection, merchant: MerchantAdminService, deliveryStats: DeliveryStatsService);
    handleMessage(input: {
        chatId: string;
        openId: string;
        text: string;
    }): Promise<void>;
    private accept;
    private cooking;
    /** 拒单第一步：只登记待确认，不执行任何退款/取消 */
    private stageReject;
    private confirmReject;
    private setPaused;
    private boardText;
    private requireOrder;
    private ctxFor;
    private isOperator;
    private isRateLimited;
    private cleanupConfirmations;
    private reply;
    private audit;
}
