"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultSchedulerStrategy = void 0;
const ms_1 = __importDefault(require("ms"));
const utils_1 = require("../../common/utils");
const config_service_1 = require("../../config/config.service");
const vendure_logger_1 = require("../../config/logger/vendure-logger");
const connection_1 = require("../../connection");
const process_context_1 = require("../../process-context");
const constants_1 = require("./constants");
const scheduled_task_record_entity_1 = require("./scheduled-task-record.entity");
const stale_task_service_1 = require("./stale-task.service");
/**
 * @description
 * The default {@link SchedulerStrategy} implementation that uses the database to
 * execute scheduled tasks. This strategy is configured when you use the
 * {@link DefaultSchedulerPlugin}.
 *
 * @since 3.3.0
 * @docsCategory scheduled-tasks
 */
class DefaultSchedulerStrategy {
    constructor() {
        this.tasks = new Map();
        this.runningTasks = [];
    }
    init(injector) {
        this.connection = injector.get(connection_1.TransactionalConnection);
        this.pluginOptions = injector.get(constants_1.DEFAULT_SCHEDULER_PLUGIN_OPTIONS);
        this.injector = injector;
        this.staleTaskService = injector.get(stale_task_service_1.StaleTaskService);
        const runTriggerCheck = injector.get(config_service_1.ConfigService).schedulerOptions.runTasksInWorkerOnly === false ||
            injector.get(process_context_1.ProcessContext).isWorker;
        if (runTriggerCheck) {
            this.intervalRef = setInterval(() => this.checkForManuallyTriggeredTasks(), this.pluginOptions.manualTriggerCheckInterval);
        }
    }
    async destroy() {
        if (this.intervalRef) {
            clearInterval(this.intervalRef);
        }
        for (const task of this.runningTasks) {
            await this.connection.rawConnection
                .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
                .update({ taskId: task.id }, { lockedAt: null });
            vendure_logger_1.Logger.info(`Released lock for task "${task.id}"`);
        }
    }
    registerTask(task) {
        this.tasks.set(task.id, {
            task,
            isRegistered: false,
        });
    }
    executeTask(task) {
        return async (_job) => {
            await this.runTask(task, { skipHoldCheck: false });
        };
    }
    async runManually(task) {
        await this.runTask(task, { skipHoldCheck: true });
    }
    async runTask(task, options) {
        var _a;
        await this.ensureTaskIsRegistered(task);
        await this.staleTaskService.cleanStaleLocksForTask(task);
        const lockAcquired = await this.tryAcquireLock(task, {
            skipHoldCheck: options.skipHoldCheck,
        });
        if (!lockAcquired) {
            return;
        }
        vendure_logger_1.Logger.verbose(`Executing scheduled task "${task.id}"`);
        let timeoutTimer;
        try {
            this.runningTasks.push(task);
            const timeout = (_a = task.options.timeout) !== null && _a !== void 0 ? _a : this.pluginOptions.defaultTimeout;
            const timeoutMs = typeof timeout === 'number' ? timeout : (0, ms_1.default)(timeout);
            const timeoutPromise = new Promise((_, reject) => {
                timeoutTimer = setTimeout(() => {
                    vendure_logger_1.Logger.warn(`Scheduled task ${task.id} timed out after ${timeoutMs}ms`);
                    reject(new Error('Task timed out'));
                }, timeoutMs);
            });
            const result = await Promise.race([task.execute(this.injector), timeoutPromise]);
            await this.connection.rawConnection.getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord).update({ taskId: task.id }, {
                lastExecutedAt: new Date(),
                lockedAt: null,
                lastResult: result !== null && result !== void 0 ? result : '',
            });
            vendure_logger_1.Logger.verbose(`Scheduled task "${task.id}" completed successfully`);
        }
        catch (error) {
            let errorMessage = 'Unknown error';
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            vendure_logger_1.Logger.error(`Scheduled task "${task.id}" failed with error: ${errorMessage}`);
            await this.connection.rawConnection.getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord).update({ taskId: task.id }, {
                lastExecutedAt: new Date(),
                lockedAt: null,
                lastResult: { error: errorMessage },
            });
        }
        finally {
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
            }
            this.runningTasks = this.runningTasks.filter(t => t !== task);
        }
    }
    async getTasks() {
        await this.ensureAllTasksAreRegistered();
        return this.connection.rawConnection
            .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
            .createQueryBuilder('task')
            .getMany()
            .then(tasks => {
            return tasks.map(task => this.entityToReport(task));
        });
    }
    async getTask(id) {
        await this.ensureTaskIsRegistered(id);
        return this.connection.rawConnection
            .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
            .createQueryBuilder('task')
            .where('task.taskId = :id', { id })
            .getOne()
            .then(task => (task ? this.entityToReport(task) : undefined));
    }
    async updateTask(input) {
        await this.connection.rawConnection
            .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
            .createQueryBuilder('task')
            .update()
            .set({ enabled: input.enabled })
            .where('taskId = :id', { id: input.id })
            .execute();
        return (0, utils_1.assertFound)(this.getTask(input.id));
    }
    async triggerTask(task) {
        vendure_logger_1.Logger.info(`Triggering task: ${task.id}`);
        await this.ensureTaskIsRegistered(task);
        await this.connection.rawConnection
            .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
            .createQueryBuilder('task')
            .update()
            .set({ manuallyTriggeredAt: new Date() })
            .where('taskId = :id', { id: task.id })
            .execute();
    }
    async checkForManuallyTriggeredTasks() {
        // Since this is run on an interval, there is an edge case where, during shutdown,
        // the connection may not be initialized anymore.
        if (!this.connection.rawConnection.isInitialized) {
            return;
        }
        let taskEntities = [];
        try {
            taskEntities = await this.connection.rawConnection
                .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
                .createQueryBuilder('task')
                .where('task.manuallyTriggeredAt IS NOT NULL')
                .getMany();
        }
        catch (e) {
            // This branch can be reached if the connection is closed and then this method
            // is called on the interval. Usually encountered in tests.
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            vendure_logger_1.Logger.error(`Error checking for manually triggered tasks: ${errorMessage}`);
        }
        vendure_logger_1.Logger.debug(`Checking for manually triggered tasks: ${taskEntities.length}`);
        for (const taskEntity of taskEntities) {
            await this.connection.rawConnection
                .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
                .update({ taskId: taskEntity.taskId }, { manuallyTriggeredAt: null });
            const task = this.tasks.get(taskEntity.taskId);
            if (task) {
                vendure_logger_1.Logger.info(`Executing manually triggered task: ${task.task.id}`);
                void this.runManually(task.task);
            }
        }
    }
    entityToReport(task) {
        return {
            id: task.taskId,
            lastExecutedAt: task.lastExecutedAt,
            isRunning: task.lockedAt !== null,
            lastResult: task.lastResult,
            enabled: task.enabled,
        };
    }
    /**
     * Hold window after task completion during which scheduled re-acquisitions
     * are rejected. Prevents a worker with a lagging clock from re-running a
     * task that has just completed on a faster worker.
     */
    computeLockHoldMs(task) {
        let intervalMs;
        try {
            intervalMs = this.staleTaskService.getScheduleIntervalMs(task);
        }
        catch (_a) {
            return constants_1.DEFAULT_MAX_LOCK_HOLD_MS;
        }
        if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
            return constants_1.DEFAULT_MAX_LOCK_HOLD_MS;
        }
        return Math.floor(Math.min(intervalMs * constants_1.DEFAULT_LOCK_HOLD_FRACTION, constants_1.DEFAULT_MAX_LOCK_HOLD_MS));
    }
    async ensureAllTasksAreRegistered() {
        for (const task of this.tasks.values()) {
            await this.ensureTaskIsRegistered(task.task);
        }
    }
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
    async tryAcquireLock(task, options = {}) {
        const dbType = this.connection.rawConnection.options.type;
        const supportsPessimisticLocking = ['postgres', 'mysql', 'mariadb'].includes(dbType);
        const holdThreshold = options.skipHoldCheck
            ? null
            : new Date(Date.now() - this.computeLockHoldMs(task));
        if (supportsPessimisticLocking) {
            // Use a transaction with pessimistic locking to ensure only one worker
            // can acquire the lock.
            return this.connection.rawConnection.transaction(async (manager) => {
                // First, try to select the task row with a FOR UPDATE lock.
                // This will block other transactions trying to select the same row
                // until this transaction commits or rolls back.
                const qb = manager
                    .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
                    .createQueryBuilder('task')
                    .setLock('pessimistic_write')
                    .where('task.taskId = :taskId', { taskId: task.id })
                    .andWhere('task.lockedAt IS NULL')
                    .andWhere('task.enabled = TRUE');
                if (holdThreshold) {
                    qb.andWhere('(task.lastExecutedAt IS NULL OR task.lastExecutedAt <= :holdThreshold)', {
                        holdThreshold,
                    });
                }
                const taskRecord = await qb.getOne();
                if (!taskRecord) {
                    // Task is either already locked, disabled, or doesn't exist
                    return false;
                }
                // Now update the lock within the same transaction
                await manager
                    .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
                    .update({ id: taskRecord.id }, { lockedAt: new Date() });
                return true;
            });
        }
        else {
            // For databases without pessimistic locking support (SQLite, SQL.js),
            // use the atomic UPDATE approach. This works for single-connection scenarios
            // but may have race conditions with multiple connections.
            const qb = this.connection.rawConnection
                .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
                .createQueryBuilder('task')
                .update()
                .set({ lockedAt: new Date() })
                .where('taskId = :taskId', { taskId: task.id })
                .andWhere('lockedAt IS NULL')
                .andWhere('enabled = TRUE');
            if (holdThreshold) {
                qb.andWhere('(lastExecutedAt IS NULL OR lastExecutedAt <= :holdThreshold)', {
                    holdThreshold,
                });
            }
            const result = await qb.execute();
            return !!result.affected;
        }
    }
    async ensureTaskIsRegistered(taskOrId) {
        const taskId = typeof taskOrId === 'string' ? taskOrId : taskOrId.id;
        const task = this.tasks.get(taskId);
        if (task && !task.isRegistered) {
            await this.connection.rawConnection
                .getRepository(scheduled_task_record_entity_1.ScheduledTaskRecord)
                .createQueryBuilder()
                .insert()
                .into(scheduled_task_record_entity_1.ScheduledTaskRecord)
                .values({ taskId })
                // Fix for versions lower than MariaDB v10.5 and MySQL: updateEntity(false) prevents TypeORM from
                // using the RETURNING clause after an INSERT. Keep in mind that this query won't return the id of the inserted record.
                .updateEntity(false)
                .orIgnore()
                .execute();
            this.tasks.set(taskId, { task: task.task, isRegistered: true });
        }
    }
}
exports.DefaultSchedulerStrategy = DefaultSchedulerStrategy;
//# sourceMappingURL=default-scheduler-strategy.js.map