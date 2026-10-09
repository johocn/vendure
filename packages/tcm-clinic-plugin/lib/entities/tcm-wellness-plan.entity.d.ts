import { DeepPartial, VendureEntity } from '@vendure/core';
export declare class TcmWellnessPlan extends VendureEntity {
    constructor(input?: DeepPartial<TcmWellnessPlan>);
    patientProfileId: number;
    clinicId: number;
    title: string;
    /** DRAFT | ACTIVE | PAUSED | CLOSED */
    status: string;
    cycleStart?: Date;
    cycleEnd?: Date;
}
