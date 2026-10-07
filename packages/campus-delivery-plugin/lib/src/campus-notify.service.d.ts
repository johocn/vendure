import { ModuleRef } from '@nestjs/core';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { CampusConfigService } from './campus-config.service';
/** 用户侧节点通知触点 */
export type CampusNotifyEvent = 'orderAccepted' | 'riderAssigned' | 'cookingDone' | 'orderDelivered' | 'exceptionHandled';
/**
 * 用户侧节点通知（公众号模板消息，touser = Customer.customFields.wechatOpenid）。
 * 设计约束：fire-and-forget——模板未配置/用户无 openid（未关注公众号）/服务未注册/
 * 发送失败一律只记日志，绝不阻塞、绝不抛出到业务主流程。
 * 字段名映射（character_string1/thing1/time2）按申请到的订单类模板而定，
 * 若模板字段不同仅需调整本文件 buildData 一处。
 */
export declare class CampusNotifyService {
    private connection;
    private config;
    private moduleRef;
    constructor(connection: TransactionalConnection, config: CampusConfigService, moduleRef: ModuleRef);
    /** vendure Injector 需由 ModuleRef 构造（与 hall.service 同款惰性解析，避免插件未注册时构造期报错） */
    private get injector();
    /** 发送节点通知（异步不等待，不抛错）。text：动态文案覆盖 thing1（如异常处置结果，超 20 字符自动截断） */
    user(ctx: RequestContext, orderId: number | string, event: CampusNotifyEvent, text?: string): void;
    /** 模板字段映射（订单号/状态/时间），字段名以申请到的模板为准 */
    private buildData;
    static formatTime(d: Date): string;
}
