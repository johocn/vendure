import { Column, Entity } from 'typeorm';
import { DeepPartial, VendureEntity } from '@vendure/core';

@Entity({ name: 'tcm_clinic' })
export class TcmClinic extends VendureEntity {
    constructor(input?: DeepPartial<TcmClinic>) {
        super(input);
    }
    @Column()
    name: string;
    /** 医疗机构执业备案号 */
    @Column({ type: 'varchar', length: 64 })
    licenseNo: string;
    @Column({ type: 'varchar', length: 255, nullable: true })
    address?: string;
    /** enabled | disabled */
    @Column({ type: 'varchar', length: 16, default: 'enabled' })
    status: string;
}
