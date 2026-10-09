import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, RequestContext, Transaction } from '@vendure/core';

import { TcmClinic } from '../entities/tcm-clinic.entity';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
import { TcmEncounter } from '../entities/tcm-encounter.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';
import { TcmEncounterService } from '../services/tcm-encounter.service';
import { CreateClinicInput, TcmClinicService } from '../services/tcm-clinic.service';
import { TcmStaffService } from '../services/tcm-staff.service';

@Resolver()
export class TcmAdminResolver {
    constructor(
        private clinicService: TcmClinicService,
        private staffService: TcmStaffService,
        private encounterService: TcmEncounterService,
    ) {}

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

    @Transaction()
    @Mutation()
    async createClinicStaff(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { clinicId: number; administratorId: number; displayName: string; role?: string },
    ): Promise<TcmClinicStaff> {
        return this.clinicService.createClinicStaff(ctx, input);
    }

    @Transaction()
    @Mutation()
    async createPatientProfile(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { clinicId: number; customerId: number; constitution?: Record<string, any> },
    ): Promise<TcmPatientProfile> {
        await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.clinicService.createPatientProfile(ctx, input);
    }

    @Transaction()
    @Mutation()
    async createEncounter(
        @Ctx() ctx: RequestContext,
        @Args('input') input: { patientProfileId: number; clinicId: number; type?: string },
    ): Promise<TcmEncounter> {
        const staff = await this.staffService.assertStaffOfClinic(ctx, input.clinicId);
        return this.encounterService.create(ctx, input, staff.id);
    }

    @Transaction()
    @Mutation()
    async startEncounter(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmEncounter> {
        return this.encounterService.transition(ctx, Number(String(id).replace('T_', '')), 'ACTIVE');
    }

    @Transaction()
    @Mutation()
    async completeEncounter(@Ctx() ctx: RequestContext, @Args('id') id: string | number): Promise<TcmEncounter> {
        return this.encounterService.transition(ctx, Number(String(id).replace('T_', '')), 'COMPLETED');
    }
}
