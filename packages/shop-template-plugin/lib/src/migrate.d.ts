import { DataSource } from 'typeorm';
/** 幂等建表：生产关闭 synchronize 时显式创建 shop_template_version */
export declare function ensureVersionTable(ds: DataSource): Promise<void>;
