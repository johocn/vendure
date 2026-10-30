import { Logger } from '@vendure/core';

/**
 * 后台兜底任务统一调度器（P2 兜底机制统一）。
 *
 * 生产只跑 API 进程、不启动 JobQueue worker，Vendure ScheduledTask 也不会执行，
 * 所有周期性兜底只能由进程内定时器驱动。本类固定同一套语义，避免各任务各写一套：
 * - 幂等 start：重复调用不叠加定时器；
 * - 单飞：上一轮未结束时本轮跳过，慢轮次不会并发堆叠；
 * - 启动延迟：bootDelayMs 后首跑，此后按 intervalMs 轮询；
 * - unref：定时器不阻止进程退出，OnApplicationShutdown 里 stop 清理；
 * - 异常隔离：本轮异常只记日志，不中断后续轮次。
 *
 * 注意：campus-delivery-plugin 内有一份同构实现（两个插件不能互相依赖），改语义需两边同步。
 */
export interface PeriodicFallbackOptions {
    /** 任务名（仅日志用） */
    name: string;
    intervalMs: number;
    /** 首跑延迟；默认 0 = 不挂 boot 定时器，首轮在 intervalMs 之后 */
    bootDelayMs?: number;
    loggerCtx?: string;
}

export class PeriodicFallback {
    private timer: ReturnType<typeof setInterval> | null = null;
    private bootTimer: ReturnType<typeof setTimeout> | null = null;
    private running = false;
    private task: (() => Promise<unknown>) | null = null;

    constructor(private readonly options: PeriodicFallbackOptions) {}

    /** 启动（幂等）：重复调用不会挂第二套定时器 */
    start(task: () => Promise<unknown>): void {
        if (this.timer || this.bootTimer) return;
        this.task = task;
        const tick = () => this.tick();
        const bootDelayMs = this.options.bootDelayMs ?? 0;
        if (bootDelayMs > 0) {
            this.bootTimer = setTimeout(() => {
                this.bootTimer = null;
                tick();
            }, bootDelayMs);
            this.unref(this.bootTimer);
        }
        this.timer = setInterval(tick, this.options.intervalMs);
        this.unref(this.timer);
    }

    /** 停止并清理（幂等） */
    stop(): void {
        if (this.bootTimer) clearTimeout(this.bootTimer);
        if (this.timer) clearInterval(this.timer);
        this.bootTimer = null;
        this.timer = null;
        this.task = null;
    }

    get started(): boolean {
        return this.timer !== null;
    }

    /** 手动触发一轮（运维/单测），与定时轮共享单飞保护 */
    async trigger(): Promise<void> {
        await this.runTask();
    }

    private tick(): void {
        void this.runTask();
    }

    private async runTask(): Promise<void> {
        if (!this.task || this.running) return;
        this.running = true;
        try {
            await this.task();
        } catch (e: any) {
            Logger.error(
                `${this.options.name} fallback tick failed: ${String(e?.message ?? e)}`,
                this.options.loggerCtx ?? 'PeriodicFallback',
            );
        } finally {
            this.running = false;
        }
    }

    private unref(timer: any): void {
        timer?.unref?.();
    }
}
