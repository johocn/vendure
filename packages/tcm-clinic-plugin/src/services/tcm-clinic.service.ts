import { Injectable } from '@nestjs/common';
import { RequestContext, TransactionalConnection } from '@vendure/core';

import { TcmClinic } from '../entities/tcm-clinic.entity';

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
}
