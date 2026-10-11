import { VendureEntity } from '@vendure/core';
import { DiyTemplateConfig, LocalizedText } from '../types';
/** DIY 玩法模板：config=slots+params+constraints+presentation；calculatorKey=null 兜底内置 sum */
export declare class DiyTemplate extends VendureEntity {
    constructor(input?: Partial<DiyTemplate>);
    app: string | null;
    /** slug，如 bracelet-classic；唯一键 (app, code) 服务层校验 */
    code: string;
    name: LocalizedText;
    description: LocalizedText | null;
    thumb: string | null;
    images: string[] | null;
    config: DiyTemplateConfig;
    calculatorKey: string | null;
    /** draft / enabled / disabled */
    status: 'draft' | 'enabled' | 'disabled';
    /** 每次发布（publish → enabled）+1；仅用于「再编辑」提示，不参与复算 */
    version: number;
    sortOrder: number;
}
