import { RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmEncounter } from '../entities/tcm-encounter.entity';
export declare class TcmEncounterService {
    private connection;
    constructor(connection: TransactionalConnection);
    create(ctx: RequestContext, input: {
        patientProfileId: number;
        clinicId: number;
        type?: string;
    }, staffId: number): Promise<TcmEncounter>;
    transition(ctx: RequestContext, id: number, to: 'ACTIVE' | 'COMPLETED'): Promise<TcmEncounter>;
}
