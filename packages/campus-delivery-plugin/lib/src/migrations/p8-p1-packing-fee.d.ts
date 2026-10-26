import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/** 店铺级打包费配置（campus_fulfillment_config） */
export declare const p8P1PackingFeeSql = "\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"packingFeeEnabled\" boolean NOT NULL DEFAULT false;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"packingFeeMode\" varchar(16) NOT NULL DEFAULT 'perItem';\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"packingFeeAmount\" int NOT NULL DEFAULT 0;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"packingFeeCap\" int;\nALTER TABLE campus_fulfillment_config ADD COLUMN IF NOT EXISTS \"packingFeeLabel\" varchar(32);\n";
/** 商品级覆盖：Product.waimaiPackingFee（分/件）→ 物理列 customFieldsWaimaipackingfee */
export declare const p8P1ProductPackingFeeSql = "\nALTER TABLE product ADD COLUMN IF NOT EXISTS \"customFieldsWaimaipackingfee\" int;\n";
export declare class P8P1PackingFeeMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
