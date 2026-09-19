import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { VendureEntity } from '@vendure/core';

@Entity('shop_template_version')
export class ShopTemplateVersion extends VendureEntity {
    constructor(input?: Partial<ShopTemplateVersion>) {
        super(input);
    }

    @Index()
    @Column()
    templateId!: number;

    @Column()
    version!: number;

    @Column({ type: 'varchar', nullable: true })
    name?: string | null;

    @Column({ type: 'simple-json', nullable: true })
    theme?: any;

    @Column({ type: 'simple-json', nullable: true })
    pages?: any;

    @Column({ default: true })
    enabled!: boolean;

    @Column({ type: 'varchar', nullable: true })
    note?: string | null;
}
