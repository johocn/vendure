import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ChannelAware, Channel, DeepPartial, EntityId, HasCustomFields, ID, VendureEntity } from '@vendure/core';

class CustomPickupLocationFields {}

@Entity()
export class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<PickupLocation>) {
        super(input);
    }

    @Column() name: string;

    @Column({ type: 'varchar', default: 'store' })
    type: 'store' | 'point' | 'employee';

    @Column() address: string;

    @Column({ nullable: true }) phoneNumber: string;

    @Column({ nullable: true }) businessHours: string;

    @Column({ type: 'simple-json', nullable: true })
    coordinates: { lat: number; lng: number } | null;

    @Column({ nullable: true }) partner: string;

    @Column({ type: 'varchar', nullable: true }) province: string | null;
    @Column({ type: 'varchar', nullable: true }) city: string | null;
    @Column({ type: 'varchar', nullable: true }) district: string | null;
    @Column({ type: 'varchar', nullable: true }) street: string | null;

    @Column({ default: false }) isPublic: boolean;

    @EntityId({ nullable: true })
    ownerChannelId: ID | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomPickupLocationFields)
    customFields: CustomPickupLocationFields;
}
