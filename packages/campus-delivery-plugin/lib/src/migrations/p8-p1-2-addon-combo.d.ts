import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
/** 商品级：加料组 JSON + 套餐内容 JSON */
export declare const p8P1_2ProductSql = "\nALTER TABLE product ADD COLUMN IF NOT EXISTS \"customFieldsWaimaiaddongroups\" text;\nALTER TABLE product ADD COLUMN IF NOT EXISTS \"customFieldsWaimaicombo\" text;\n";
/** 订单行级：加料选择快照 JSON */
export declare const p8P1_2OrderLineSql = "\nALTER TABLE order_line ADD COLUMN IF NOT EXISTS \"customFieldsWaimaiaddons\" text;\n";
export declare class P8P1AddonComboMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
