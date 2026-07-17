import { Column, Entity, JoinTable, ManyToMany, ManyToOne } from 'typeorm';
import {
    Channel,
    Customer,
    DeepPartial,
    EntityId,
    ID,
    VendureEntity,
} from '@vendure/core';
import { PickupLocation } from '../pickup-location.entity';

@Entity()
export class EmployeeCustomer extends VendureEntity {
    constructor(input?: DeepPartial<EmployeeCustomer>) {
        super(input);
    }

    @ManyToOne(() => Customer)
    customer: Customer;

    @EntityId()
    customerId: ID;

    @Column()
    enterpriseName: string;

    @Column({ nullable: true })
    employeeId: string;

    @ManyToMany(() => PickupLocation)
    @JoinTable({
        name: 'employee_customer_pickup_location',
        joinColumn: { name: 'employee_customer_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'pickup_location_id', referencedColumnName: 'id' },
    })
    pickupLocations: PickupLocation[];

    @ManyToOne(() => Channel)
    channel: Channel;

    @EntityId()
    channelId: ID;

    @Column({ default: false })
    verified: boolean;
}
