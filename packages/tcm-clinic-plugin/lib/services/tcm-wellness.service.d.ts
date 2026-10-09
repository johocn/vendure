import { RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmFollowUpTask } from '../entities/tcm-follow-up-task.entity';
import { TcmPlanItem } from '../entities/tcm-plan-item.entity';
import { TcmWellnessPlan } from '../entities/tcm-wellness-plan.entity';
import { TcmAuditService } from './tcm-audit.service';
export declare class TcmWellnessService {
    private connection;
    private audit;
    constructor(connection: TransactionalConnection, audit: TcmAuditService);
    createPlan(ctx: RequestContext, staffId: number, input: {
        patientProfileId: number;
        clinicId: number;
        title: string;
        cycleStart?: Date;
        cycleEnd?: Date;
    }): Promise<TcmWellnessPlan>;
    transitionPlan(ctx: RequestContext, staffId: number, id: number, to: 'ACTIVE' | 'PAUSED' | 'CLOSED'): Promise<TcmWellnessPlan>;
    addPlanItem(ctx: RequestContext, input: {
        planId: number;
        title: string;
        frequency?: string;
        productVariantId?: number;
    }): Promise<TcmPlanItem>;
    createFollowUp(ctx: RequestContext, staffId: number, input: {
        patientProfileId: number;
        planId?: number;
        title: string;
        dueAt: Date;
        channel?: string;
    }): Promise<TcmFollowUpTask>;
    completeFollowUp(ctx: RequestContext, staffId: number, id: number, followUpEncounterId?: number): Promise<TcmFollowUpTask>;
    cancelFollowUp(ctx: RequestContext, staffId: number, id: number): Promise<TcmFollowUpTask>;
    itemsOfPlan(ctx: RequestContext, planId: number): Promise<TcmPlanItem[]>;
}
