/**
 * 后台兜底任务统一调度器（P2 兜底机制统一）。
 *
 * 生产只跑 API 进程、不启动 JobQueue worker，Vendure ScheduledTask 也不会执行，
 * 所有周期性兜底只能由进程内定时器驱动。本类固定同一套语义，避免各任务各写一套：
 * - 幂等 start：重复调用不叠加定时器；
 * - 单飞：上一轮未结束时本轮跳过，慢轮次不会并发堆叠；
 * - 启动延迟：bootDelayMs 后首跑（等迁移补列 / DB 连接稳定），此后按 intervalMs 轮询；
 * - unref：定时器不阻止进程退出，OnApplicationShutdown 里 stop 清理；
 * - 异常隔离：本轮异常只记日志，不中断后续轮次。
 *
 * 注意：after-sales-plugin 内有一份同构实现（两个插件不能互相依赖），改语义需两边同步。
 */
export interface PeriodicFallbackOptions {
    /** 任务名（仅日志用） */
    name: string;
    intervalMs: number;
    /** 首跑延迟；默认 0 = 不挂 boot 定时器，首轮在 intervalMs 之后 */
    bootDelayMs?: number;
    loggerCtx?: string;
}
export declare class PeriodicFallback {
    private readonly options;
    private timer;
    private bootTimer;
    private running;
    private task;
    constructor(options: PeriodicFallbackOptions);
    /** 启动（幂等）：重复调用不会挂第二套定时器 */
    start(task: () => Promise<unknown>): void;
    /** 停止并清理（幂等） */
    stop(): void;
    get started(): boolean;
    /** 手动触发一轮（运维/单测），与定时轮共享单飞保护 */
    trigger(): Promise<void>;
    private tick;
    private runTask;
    private unref;
}
