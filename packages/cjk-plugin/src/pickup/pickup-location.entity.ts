import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ChannelAware, Channel, DeepPartial, HasCustomFields, VendureEntity } from '@vendure/core';

class CustomPickupLocationFields {}

@Entity()
export class PickupLocation extends VendureEntity implements ChannelAware, HasCustomFields {
    constructor(input?: DeepPartial<PickupLocation>) {
        super(input);
    }

    @Column() name: string;

    @Column() type: 'store' | 'point';

    @Column() address: string;

    @Column({ nullable: true }) phoneNumber: string;

    @Column({ nullable: true }) businessHours: string;

    @Column({ type: 'simple-json', nullable: true })
    coordinates: { lat: number; lng: number } | null;

    @Column({ nullable: true }) partner: string;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];

    @Column(() => CustomPickupLocationFields)
    customFields: CustomPickupLocationFields;
}
