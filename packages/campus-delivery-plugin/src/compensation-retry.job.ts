import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, RequestContext, RequestContextService } from '@vendure/core';
import { CampusNotifyService } from './campus-notify.service';
import { CampusCompensationTask } from './compensation-task.entity';
import { CompensationTaskService } from './compensation-task.service';
import { FeishuNotifyService } from './feishu/feishu-notify.service';
import { PeriodicFallback } from './periodic-fallback';

const MAX_ATTEMPTS = 5;
/** 第 1/2/3/4 次失败后的退避（分钟）：1 → 5 → 15 → 60；第 5 次耗尽转 failed */
const BACKOFF_MINUTES = [1, 5, 15, 60];

/** 补偿券执行器（生产走 coupon-plugin，单测可直接注入） */
export interface CouponExecutor {
    grantCoupon: (ctx: any, templateId: any, customerIds: any[]) => Promise<any>;
}

/**
 * R2 补偿任务重试（每 1 分钟）：券补发 / 站内信补发。
 * 多实例安全：先按 `attempts` 条件认领，只有认领成功的实例执行；
 * 重试耗尽只告警一次（dedupeKey=compensation_exhausted:<任务键>）。
 */
@Injectable()
export class CompensationRetryJob implements OnApplicationShutdown {
    private fallback: PeriodicFallback | null = null;
    /** 可选：直接指定补偿券执行器（单测/裁剪部署用；生产为 null 走动态解析）。
     *  注意不能作为构造参数：接口类型在运行时为 Object，Nest 会尝试注入并启动失败。 */
    couponOverride: CouponExecutor | null = null;

    constructor(
        private tasks: CompensationTaskService,
        private notify: CampusNotifyService,
        private feishu: FeishuNotifyService,
        private requestContextService: RequestContextService,
        private moduleRef: ModuleRef,
    ) {}

    start(intervalMs = 60_000): void {
        if (this.fallback) return;
        this.fallback = new PeriodicFallback({ name: 'compensation-retry', intervalMs, loggerCtx: 'CampusCompensation' });
        this.fallback.start(async () => {
            await this.runOnce();
        });
    }

    onApplicationShutdown(): void {
        this.fallback?.stop();
        this.fallback = null;
    }

    /** 处理一批到期任务（运维/单测可直接调用） */
    async runOnce(limit = 20): Promise<{ done: number; retried: number; failed: number }> {
        const due = await this.tasks.due(limit);
        let done = 0;
        let retried = 0;
        let failed = 0;
        for (const task of due) {
            if (!(await this.tasks.claim(task.id as number, task.attempts))) continue;
            const attempts = task.attempts + 1;
            try {
                await this.execute(task);
                await this.tasks.markDone(task.id as number);
                done++;
            } catch (e: any) {
                const message = String(e?.message ?? e);
                const exhausted = attempts >= MAX_ATTEMPTS;
                const next = exhausted ? null : new Date(Date.now() + this.backoffMinutes(attempts) * 60_000);
                await this.tasks.markFailed(task.id as number, exhausted, message, next);
                if (exhausted) {
                    failed++;
                    Logger.error(`补偿任务耗尽（${task.dedupeKey}）：${message}`, 'CampusCompensation');
                    void this.feishu.pushEvent(
                        'alert',
                        '补偿任务重试耗尽',
                        `${task.kind === 'coupon' ? '补偿券' : '站内信'}补发失败（订单 ${task.orderId}），已重试 ${attempts} 次，请人工处理。原因：${message}`,
                        undefined,
                        `compensation_exhausted:${task.dedupeKey}`,
                    );
                } else {
                    retried++;
                    Logger.warn(`补偿任务重试 ${attempts}/${MAX_ATTEMPTS}（${task.dedupeKey}）：${message}`, 'CampusCompensation');
                }
            }
        }
        return { done, retried, failed };
    }

    private backoffMinutes(attempts: number): number {
        return BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
    }

    private async execute(task: CampusCompensationTask): Promise<void> {
        const payload = this.parsePayload(task);
        if (task.kind === 'coupon') {
            const svc = this.couponService();
            if (!svc) throw new Error('coupon-plugin 未启用');
            if (task.customerId == null) throw new Error('缺少 customerId');
            const templateId = String(payload.templateId ?? '');
            if (!templateId) throw new Error('缺少 templateId');
            const pc = await this.platformCtx();
            await svc.grantCoupon(pc, templateId as any, [task.customerId as any]);
            return;
        }
        // notify：幂等键在 message 落库前由站内信自身保证；这里只重放写入
        await this.notify.retryInApp(
            task.orderId,
            task.channelId,
            String(payload.event ?? '') as any,
            payload.text == null ? undefined : String(payload.text),
        );
    }

    private parsePayload(task: CampusCompensationTask): Record<string, any> {
        try {
            return task.payload ? JSON.parse(task.payload) : {};
        } catch {
            return {};
        }
    }

    private async platformCtx(): Promise<RequestContext> {
        return this.requestContextService.create({ apiType: 'admin' });
    }

    private injector(): Injector {
        return new Injector(this.moduleRef);
    }

    /** coupon-plugin 为可选依赖：优先用注入的执行器，否则动态 require + Injector 解析 */
    private couponService(): CouponExecutor | null {
        if (this.couponOverride) return this.couponOverride;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const mod: any = require('@vendure/coupon-plugin');
            if (mod?.CouponService) return this.injector().get(mod.CouponService) ?? null;
        } catch {
            // coupon-plugin 未安装或未启用
        }
        return null;
    }
}
