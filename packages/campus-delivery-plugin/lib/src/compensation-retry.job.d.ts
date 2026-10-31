import { OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RequestContextService } from '@vendure/core';
import { CampusNotifyService } from './campus-notify.service';
import { CompensationTaskService } from './compensation-task.service';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
/** 补偿券执行器（生产走 coupon-plugin，单测可直接注入） */
export interface CouponExecutor {
    grantCoupon: (ctx: any, templateId: any, customerIds: any[]) => Promise<any>;
}
/**
 * R2 补偿任务重试（每 1 分钟）：券补发 / 站内信补发。
 * 多实例安全：先按 `attempts` 条件认领，只有认领成功的实例执行；
 * 重试耗尽只告警一次（dedupeKey=compensation_exhausted:<任务键>）。
 */
export declare class CompensationRetryJob implements OnApplicationShutdown {
    private tasks;
    private notify;
    private feishu;
    private requestContextService;
    private moduleRef;
    private fallback;
    /** 可选：直接指定补偿券执行器（单测/裁剪部署用；生产为 null 走动态解析）。
     *  注意不能作为构造参数：接口类型在运行时为 Object，Nest 会尝试注入并启动失败。 */
    couponOverride: CouponExecutor | null;
    constructor(tasks: CompensationTaskService, notify: CampusNotifyService, feishu: FeishuNotifyService, requestContextService: RequestContextService, moduleRef: ModuleRef);
    start(intervalMs?: number): void;
    onApplicationShutdown(): void;
    /** 处理一批到期任务（运维/单测可直接调用） */
    runOnce(limit?: number): Promise<{
        done: number;
        retried: number;
        failed: number;
    }>;
    private backoffMinutes;
    private execute;
    private parsePayload;
    private platformCtx;
    private injector;
    /** coupon-plugin 为可选依赖：优先用注入的执行器，否则动态 require + Injector 解析 */
    private couponService;
}
