import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

export enum InvoiceType {
    ORDINARY = 'ordinary',
    SPECIAL = 'special',
    ELECTRONIC = 'electronic',
}

export enum InvoiceStatus {
    PENDING = 'pending',
    ISSUED = 'issued',
    REVERSED = 'reversed',
    FAILED = 'failed',
}

@Entity()
export class Invoice extends VendureEntity implements ChannelAware {
    constructor(input?: DeepPartial<Invoice>) {
        super(input);
    }

    @Column({ type: 'varchar' }) invoiceType: InvoiceType;

    @Column({ type: 'varchar', default: InvoiceStatus.PENDING }) status: InvoiceStatus;

    @Column({ type: 'text' }) title: string;

    @Column({ nullable: true }) taxNumber: string;

    @Column({ nullable: true }) email: string;

    @Column({ nullable: true }) companyAddress: string;

    @Column({ nullable: true }) companyPhone: string;

    @Column({ nullable: true }) bankName: string;

    @Column({ nullable: true }) bankAccount: string;

    @Column({ type: 'int' }) amount: number;

    @Column() customerId: number;

    @Column({ type: 'simple-json' }) orderIds: number[];

    @Column({ type: 'varchar', nullable: true }) pdfUrl: string | null;

    @Column({ nullable: true }) issuedAt?: Date;

    @Column({ nullable: true }) reversedAt?: Date;

    @Column({ type: 'text', nullable: true }) reverseReason: string | null;

    @Column({ type: 'varchar', nullable: true }) providerInvoiceNo: string | null;

    @Column({ type: 'text', nullable: true }) lastError: string | null;

    @ManyToMany(() => Channel)
    @JoinTable()
    channels: Channel[];
}
