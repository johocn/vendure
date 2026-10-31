import { ID, RequestContext } from '@vendure/core';
import { CompensationTaskService } from './compensation-task.service';
/** 运营侧：R2 补偿任务查看与手动重试（失败任务不再只能靠 SQL/巡检发现） */
export declare class CompensationAdminResolver {
    private tasks;
    constructor(tasks: CompensationTaskService);
    campusCompensationTasks(ctx: RequestContext, status?: string, skip?: number, take?: number): Promise<{
        items: import("./compensation-task.entity").CampusCompensationTask[];
        total: number;
    }>;
    campusRetryCompensationTask(ctx: RequestContext, id: ID): Promise<boolean>;
}
