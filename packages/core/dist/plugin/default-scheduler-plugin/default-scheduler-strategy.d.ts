import { UpdateScheduledTaskInput } from '@vendure/common/lib/generated-types';
import { Cron } from 'croner';
import { Injector } from '../../common';
import { ScheduledTask } from '../../scheduler/scheduled-task';
import { SchedulerStrategy, TaskReport } from '../../scheduler/scheduler-strategy';
/**
 * @description
 * The default {@link SchedulerStrategy} implementation that uses the database to
 * execute scheduled tasks. This strategy is configured when you use the
 * {@link DefaultSchedulerPlugin}.
 *
 * @since 3.3.0
 * @docsCategory scheduled-tasks
 */
export declare class DefaultSchedulerStrategy implements SchedulerStrategy {
    private connection;
    private injector;
    private intervalRef;
    private readonly tasks;
    private pluginOptions;
    private runningTasks;
    private staleTaskService;
    init(injector: Injector): void;
    destroy(): Promise<void>;
    registerTask(task: ScheduledTask): void;
    executeTask(task: ScheduledTask): (_job?: Cron) => Promise<void>;
    private runManually;
    private runTask;
    getTasks(): Promise<TaskReport[]>;
    getTask(id: string): Promise<TaskReport | undefined>;
    updateTask(input: UpdateScheduledTaskInput): Promise<TaskReport>;
    triggerTask(task: ScheduledTask): Promise<void>;
    private checkForManuallyTriggeredTasks;
    private entityToReport;
    /**
     * Hold window after task completion during which scheduled re-acquisitions
     * are rejected. Prevents a worker with a lagging clock from re-running a
     * task that has just completed on a faster worker.
     */
    private computeLockHoldMs;
    private ensureAllTasksAreRegistered;
    /**
     * Attempts to acquire a lock for the given task.
     *
     * For databases that support pessimistic locking (PostgreSQL, MySQL, MariaDB),
     * we use SELECT ... FOR UPDATE to ensure only one worker can acquire the lock.
     * This is necessary because PostgreSQL's MVCC can allow multiple concurrent
     * UPDATE statements to succeed when using a simple "UPDATE ... WHERE lockedAt IS NULL" pattern.
     *
     * For databases that don't support pessimistic locking (SQLite, SQL.js),
     * we fall back to the atomic UPDATE approach which works correctly for single-connection scenarios.
     *
     * `skipHoldCheck` lets manual triggers bypass the post-completion hold
     * window (see `computeLockHoldMs`); they are already deduplicated via
     * `manuallyTriggeredAt` and have no inter-worker race.
     */
    private tryAcquireLock;
    private ensureTaskIsRegistered;
}
