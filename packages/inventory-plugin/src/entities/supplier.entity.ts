// e:\code\vendure\packages\inventory-plugin\src\entities\supplier.entity.ts
import { Column, Entity, ManyToMany, JoinTable } from 'typeorm';
import { Channel, DeepPartial, VendureEntity } from '@vendure/core';

@Entity()
export class Supplier extends VendureEntity {
    constructor(input?: DeepPartial<Supplier>) {
        super(input);
    }

    @Column({ unique: true }) code: string;
    @Column() name: string;
    @Column({ nullable: true }) taxNumber: string;
    @Column({ nullable: true }) contactName: string;
    @Column({ nullable: true }) contactPhone: string;
    @Column({ nullable: true }) address: string;
    /** 结账账期（天） */
    @Column({ type: 'int', default: 0 }) settlementDays: number;
    @Column({ nullable: true }) note: string;

    @Column({ type: 'int' }) channelId: number;
    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}