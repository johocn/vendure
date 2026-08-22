import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { Channel, ChannelAware, DeepPartial, VendureEntity } from '@vendure/core';

export type InvoiceTypeValue = 'ordinary' | 'special' | 'electronic';

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

/** 发票行级明细快照（开票时固化，与订单解耦） */
export interface InvoiceLine {
    orderId: number;
    orderCode: string;
    productVariantId?: number;
    sku?: string;
    name: string;
    quantity: number;
    unitPrice: number; // 不含税单价（分）
    unitPriceWithTax: number; // 含税单价（分）
    amount: number; // 不含税金额（分）= unitPrice * quantity
    taxRate: number; // 税率 %
    taxAmount: number; // 税额（分）= amount * taxRate / 100
    amountWithTax: number; // 价税合计（分）= amount + taxAmount
}

/** 价税分离汇总 */
export interface InvoiceTotals {
    totalExcludingTax: number; // 不含税合计（分）
    totalTax: number; // 税额合计（分）
    totalWithTax: number; // 价税合计（分）
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

    @Column({ nullable: true }) channelId?: number;

    @Column({ type: 'simple-json' }) orderIds: number[];

    /** 行级明细快照（开票时固化，价税分离） */
    @Column({ type: 'simple-json', nullable: true }) lines: InvoiceLine[] | null;

    /** 价税分离汇总（分） */
    @Column({ type: 'simple-json', nullable: true }) totals: InvoiceTotals | null;

    /** 统一发票号（issue 时回填，= providerInvoiceNo） */
    @Column({ type: 'varchar', nullable: true }) invoiceNo: string | null;

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
