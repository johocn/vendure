import { Injectable } from '@nestjs/common';
import { IllegalOperationError, RequestContext, TransactionalConnection, UserInputError } from '@vendure/core';

import { TcmEncounter } from '../entities/tcm-encounter.entity';

const TRANSITIONS: Record<string, string[]> = {
    PENDING: ['ACTIVE'],
    ACTIVE: ['COMPLETED'],
    COMPLETED: [],
};

@Injectable()
export class TcmEncounterService {
    constructor(private connection: TransactionalConnection) {}

    async create(
        ctx: RequestContext,
        input: { patientProfileId: number; clinicId: number; type?: string },
        staffId: number,
    ): Promise<TcmEncounter> {
        const repo = this.connection.getRepository(ctx, TcmEncounter);
        const open = await repo.findOne({
            where: { patientProfileId: input.patientProfileId, status: 'PENDING' },
        });
        const openActive = open ?? (await repo.findOne({
            where: { patientProfileId: input.patientProfileId, status: 'ACTIVE' },
        }));
        if (openActive) {
            throw new UserInputError('该患者已有未完成接诊');
        }
        return repo.save(
            new TcmEncounter({ ...input, staffId, type: input.type ?? 'initial', status: 'PENDING' }),
        );
    }

    async transition(ctx: RequestContext, id: number, to: 'ACTIVE' | 'COMPLETED'): Promise<TcmEncounter> {
        const repo = this.connection.getRepository(ctx, TcmEncounter);
        const encounter = await repo.findOne({ where: { id } });
        if (!encounter) {
            throw new UserInputError(`接诊不存在：${id}`);
        }
        if (!TRANSITIONS[encounter.status].includes(to)) {
            throw new IllegalOperationError(`非法状态迁移：${encounter.status} → ${to}`);
        }
        encounter.status = to;
        return repo.save(encounter); // VersionColumn 触发乐观锁
    }
}
