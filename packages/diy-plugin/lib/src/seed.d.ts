import { TransactionalConnection } from '@vendure/core';
import { DiyTemplateConfig } from './types';
/** 幂等种子：平台分类（app=null） */
export declare function seedDiy(connection: TransactionalConnection): Promise<void>;
export declare const BRACELET_CLASSIC: DiyTemplateConfig;
/** 幂等种入平台配饰素材；缺分类码时跳过并告警（不中断模板 seed） */
export declare function seedDecorMaterials(connection: TransactionalConnection): Promise<void>;
/** 幂等增补现有素材 attrs 详情字段（meaning 已存在则跳过该条） */
export declare function enrichBeadMaterials(connection: TransactionalConnection): Promise<void>;
