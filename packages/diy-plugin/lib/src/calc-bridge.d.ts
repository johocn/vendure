import { CalcBom, CalculatorOutput } from '@diy/calc';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyPlanBom, DiyPlanSpec } from './types';
/**
 * 复算桥（规格 §6.2/§6.3，双端同构核心）：
 * spec.slots（slotKey → 选择）+ 合并素材 → @diy/calc CalculatorInput → CalculatorOutput。
 * 抛错语义：模板 config 非法 / slot 键不存在 / 引用素材不在合并视图 —— 调用方（service）转 UserInputError。
 * languageCode 传 Vendure 原生码（如 zh_Hans），内部经 resolveLocaleKey 映射 jsonb 键。
 */
export declare function runDiyCalc(template: Pick<DiyTemplate, 'calculatorKey' | 'config'>, spec: DiyPlanSpec, materials: DiyMaterial[], languageCode: string): CalculatorOutput;
/** CalcBom（cord/geometry 可为 null）→ DiyPlanBom（可选字段），落库前规范化 */
export declare function toPlanBom(bom: CalcBom): DiyPlanBom;
