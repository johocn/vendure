import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { TcmClinic } from '../entities/tcm-clinic.entity';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';

export interface CreateClinicInput {
    name: string;
    licenseNo: string;
    address?: string;
}

@Injectable()
export class TcmClinicService {
    constructor(private connection: TransactionalConnection) {}

    async createClinic(ctx: RequestContext, input: CreateClinicInput): Promise<TcmClinic> {
        const repo = this.connection.getRepository(ctx, TcmClinic);
        const clinic = await repo.save(new TcmClinic({ ...input, status: 'enabled' }));
        return clinic;
    }

    async findAll(ctx: RequestContext): Promise<TcmClinic[]> {
        return this.connection.getRepository(ctx, TcmClinic).find({ order: { id: 'ASC' } });
    }

    async findOne(ctx: RequestContext, id: number): Promise<TcmClinic | null> {
        return this.connection.getRepository(ctx, TcmClinic).findOne({ where: { id } });
    }

    async createClinicStaff(
        ctx: RequestContext,
        input: { clinicId: number; administratorId: number; displayName: string; role?: string },
    ): Promise<TcmClinicStaff> {
        return this.connection
            .getRepository(ctx, TcmClinicStaff)
            .save(new TcmClinicStaff({ ...input, role: input.role ?? 'doctor' }));
    }

    async createPatientProfile(
        ctx: RequestContext,
        input: { clinicId: number; customerId: number; constitution?: Record<string, any> },
    ): Promise<TcmPatientProfile> {
        const repo = this.connection.getRepository(ctx, TcmPatientProfile);
        const existing = await repo.findOne({ where: { customerId: input.customerId } });
        if (existing) {
            return existing; // 跨馆共享一份档案
        }
        return repo.save(new TcmPatientProfile(input));
    }

    async findPatientProfile(ctx: RequestContext, id: number): Promise<TcmPatientProfile | null> {
        return this.connection.getRepository(ctx, TcmPatientProfile).findOne({ where: { id } });
    }
}
