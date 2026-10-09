import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction } from '@vendure/core';

import { TcmClinic } from '../entities/tcm-clinic.entity';
import { CreateClinicInput, TcmClinicService } from '../services/tcm-clinic.service';

@Resolver()
export class TcmAdminResolver {
    constructor(private clinicService: TcmClinicService) {}

    @Transaction()
    @Query()
    async clinics(
        @Ctx() ctx: RequestContext,
        @Args('options') _options: any,
    ): Promise<{ items: TcmClinic[]; totalItems: number }> {
        const items = await this.clinicService.findAll(ctx);
        return { items, totalItems: items.length };
    }

    @Transaction()
    @Mutation()
    async createClinic(@Ctx() ctx: RequestContext, @Args('input') input: CreateClinicInput): Promise<TcmClinic> {
        return this.clinicService.createClinic(ctx, input);
    }
}
