import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('stock_doc_item')
export class StockDocItemEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column() docId!: number;
  @Column() variantId!: number;
  @Column({ nullable: true }) fromStockLocationId!: number; // TRANSFER/STOCKTAKE/ISSUE 源仓
  @Column({ nullable: true }) toStockLocationId!: number;   // PURCHASE/STOCKTAKE/TRANSFER 目标仓
  @Column({ type: 'int', default: 0 }) qty!: number;        // 单上数量
  @Column({ type: 'int', nullable: true }) realQty!: number; // 盘库实盘
  @Column({ type: 'int', nullable: true }) costPrice!: number; // 分；采购/移库成本
  @Column({ type: 'int', default: 0 }) difference!: number;  // 盘盈/盘亏
}