// e:\code\vendure\packages\operations-plugin\src\content-lifecycle.task.ts
import { Logger, ScheduledTask } from '@vendure/core';

import { loggerCtx } from './constants';
import { ContentService } from './content.service';

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
export const contentLifecycleTask = new ScheduledTask({
    id: 'operations-content-lifecycle',
    description: 'Auto publish/unpublish content items based on startAt/endAt',
    schedule: '* * * * *',
    timeout: 30_000,
    preventOverlap: true,
    async execute({ injector, scheduledContext }) {
        const contentService = injector.get(ContentService);
        const result = await contentService.runLifecycleCheck(scheduledContext);
        if (result.published > 0 || result.unpublished > 0) {
            Logger.info(
                `Content lifecycle: published=${result.published}, unpublished=${result.unpublished}`,
                loggerCtx,
            );
        }
        return result;
    },
});
