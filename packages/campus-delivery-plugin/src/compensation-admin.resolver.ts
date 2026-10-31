import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, RequestContext } from '@vendure/core';
import { CompensationTaskService } from './compensation-task.service';
import { CampusPermissions } from './permissions';

/** 运营侧：R2 补偿任务查看与手动重试（失败任务不再只能靠 SQL/巡检发现） */
@Resolver()
export class CompensationAdminResolver {
    constructor(private tasks: CompensationTaskService) {}

    @Query()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusCompensationTasks(
        @Ctx() ctx: RequestContext,
        @Args({ name: 'status', type: () => String, nullable: true }) status?: string,
        @Args({ name: 'skip', type: () => Number, nullable: true }) skip?: number,
        @Args({ name: 'take', type: () => Number, nullable: true }) take?: number,
    ) {
        return this.tasks.list(status, skip, take);
    }

    @Mutation()
    @Allow(CampusPermissions.CampusDispatch as any)
    async campusRetryCompensationTask(@Ctx() ctx: RequestContext, @Args('id') id: ID): Promise<boolean> {
        return this.tasks.retry(Number(id));
    }
}
