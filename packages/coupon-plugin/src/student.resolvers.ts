import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, Transaction } from '@vendure/core';

import { StudentVerificationService } from './student.service';

/**
 * 学生认证（人工审核流）resolver：
 * - shop-api：myStudentVerification / applyStudentVerification（登录用户）
 * - admin-api：studentVerifications / reviewStudentVerification（需 UpdateCustomer 权限）
 */
@Resolver()
export class StudentShopResolver {
    constructor(private studentService: StudentVerificationService) {}

    @Query()
    @Allow(Permission.Authenticated)
    async myStudentVerification(@Ctx() ctx: RequestContext) {
        return this.studentService.myStatus(ctx);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.Authenticated)
    async applyStudentVerification(
        @Ctx() ctx: RequestContext,
        @Args('school') school: string,
        @Args('studentNo') studentNo: string,
        @Args('idImg', { nullable: true }) idImg?: string,
    ) {
        return this.studentService.apply(ctx, { school, studentNo, idImg: idImg ?? null });
    }
}

@Resolver()
export class StudentAdminResolver {
    constructor(private studentService: StudentVerificationService) {}

    @Query()
    @Allow(Permission.UpdateCustomer)
    async studentVerifications(@Ctx() ctx: RequestContext, @Args('status', { nullable: true }) status?: string) {
        return this.studentService.list(ctx, status ?? undefined);
    }

    @Mutation()
    @Transaction()
    @Allow(Permission.UpdateCustomer)
    async reviewStudentVerification(
        @Ctx() ctx: RequestContext,
        @Args('customerId') customerId: string,
        @Args('approve') approve: boolean,
    ) {
        return this.studentService.review(ctx, Number(customerId), approve);
    }
}
