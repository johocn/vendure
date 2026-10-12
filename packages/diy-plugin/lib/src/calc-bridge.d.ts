import { CalcBom, CalculatorOutput } from '@diy/calc';
import { DiyMaterial } from './entities/diy-material.entity';
import { DiyTemplate } from './entities/diy-template.entity';
import { DiyPlanBom, DiyPlanSpec } from './types';
/**
 * 复算桥（规格 §6.2/§6.3，双端同构核心）：
 * - v2 路径（spec.slotList 非空）：数组槽位（多主珠/多隔片/decor）→
 *   有 sequence 走 sequenceGeometry（自由/规律序列，前端 seeded 生成保证可复现），
 *   否则走 braceletCalculator v2 多槽位收敛路径；
 * - v1 路径（仅 spec.slots 对象）：slotKey → 选择 + 模板 config keyToRole，存量方案零回归。
 * 抛错语义：模板 config 非法 / slot 键不存在 / 引用素材不在合并视图 —— 调用方（service）转 UserInputError。
 * languageCode 传 Vendure 原生码（如 zh_Hans），内部经 resolveLocaleKey 映射 jsonb 键。
 */
export declare function runDiyCalc(template: Pick<DiyTemplate, 'calculatorKey' | 'config'>, spec: DiyPlanSpec, materials: DiyMaterial[], languageCode: string): CalculatorOutput;
/** CalcBom（cord/geometry 可为 null）→ DiyPlanBom（可选字段），落库前规范化 */
export declare function toPlanBom(bom: CalcBom): DiyPlanBom;
