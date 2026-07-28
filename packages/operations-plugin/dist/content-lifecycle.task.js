"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentLifecycleTask = void 0;
// e:\code\vendure\packages\operations-plugin\src\content-lifecycle.task.ts
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const content_service_1 = require("./content.service");
/**
 * @description
 * ScheduledTask that runs every minute to auto-publish/unpublish ContentItems
 * based on their startAt/endAt fields.
 *
 * Uses Vendure's built-in ScheduledTask (v3.3+):
 * - Executed by DefaultSchedulerPlugin in worker process
 * - Multi-instance: only-once via DB lock
 * - Survives process restarts
 *
 * Reference: flash-sale-plugin/src/flash-sale.job.ts
 */
exports.contentLifecycleTask = new core_1.ScheduledTask({
    id: 'operations-content-lifecycle',
    description: 'Auto publish/unpublish content items based on startAt/endAt',
    schedule: '* * * * *',
    timeout: 30000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const contentService = injector.get(content_service_1.ContentService);
        const result = await contentService.runLifecycleCheck(scheduledContext);
        if (result.published > 0 || result.unpublished > 0) {
            core_1.Logger.info(`Content lifecycle: published=${result.published}, unpublished=${result.unpublished}`, constants_1.loggerCtx);
        }
        return result;
    },
});
