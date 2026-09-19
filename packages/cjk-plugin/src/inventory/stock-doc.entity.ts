import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export type StockDocType = 'PURCHASE' | 'TRANSFER' | 'STOCKTAKE' | 'ISSUE';

@Entity('stock_doc')
export class StockDocEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column() type!: string;           // StockDocType
  @Column() tenantChannelId!: string; // scoped by channel
  @Column({ unique: true }) code!: string;
  @Column({ type: 'text', nullable: true }) remark!: string;
  @Column({ nullable: true }) operator!: string;
  @Column() createdAt!: Date;
}