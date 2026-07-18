"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulerRaceTestTask = void 0;
const core_1 = require("@vendure/core");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_FILE = path_1.default.join(__dirname, '../../scheduler-race-log.json');
const WORKER_ID = `worker-${process.pid}`;
/**
 * A scheduled task designed to test for race conditions in the DefaultSchedulerStrategy.
 *
 * This task:
 * - Runs every 5 seconds
 * - Logs execution details with worker PID to a JSON file
 * - Simulates 2 seconds of work to increase the window for race conditions
 *
 * To test:
 * 1. Start multiple workers: `DB=postgres npm run dev:worker` (in separate terminals)
 * 2. Let them run for a minute or two
 * 3. Check the log file for duplicate triggerKeys from different workers
 *
 * If the same triggerKey appears with different workerIds, that's a race condition!
 */
exports.schedulerRaceTestTask = new core_1.ScheduledTask({
    id: 'scheduler-race-test',
    description: 'Tests for race conditions in scheduled task execution',
    // Every 5 seconds (6-part cron: seconds minutes hours day month weekday)
    schedule: '*/5 * * * * *',
    async execute({ injector }) {
        const startTime = new Date().toISOString();
        // Create a trigger key by rounding to nearest 5-second boundary
        // This groups executions that should have been the same trigger
        const triggerTime = new Date();
        triggerTime.setMilliseconds(0);
        triggerTime.setSeconds(Math.floor(triggerTime.getSeconds() / 5) * 5);
        const triggerKey = triggerTime.toISOString();
        core_1.Logger.info(`[${WORKER_ID}] ⏰ Starting scheduled task at ${startTime} (trigger: ${triggerKey})`);
        // Simulate some work (2 seconds) - increases the chance of detecting race conditions
        await new Promise(resolve => setTimeout(resolve, 2000));
        const endTime = new Date().toISOString();
        const logEntry = {
            workerId: WORKER_ID,
            triggerKey,
            startTime,
            endTime,
        };
        // Append to log file
        let logs = [];
        try {
            const existing = fs_1.default.readFileSync(LOG_FILE, 'utf-8');
            logs = JSON.parse(existing);
        }
        catch (e) {
            // File doesn't exist yet, that's fine
        }
        logs.push(logEntry);
        fs_1.default.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
        core_1.Logger.info(`[${WORKER_ID}] ✅ Finished scheduled task at ${endTime}`);
        return { workerId: WORKER_ID, triggerKey, startTime, endTime };
    },
});
//# sourceMappingURL=scheduler-race-test-task.js.map