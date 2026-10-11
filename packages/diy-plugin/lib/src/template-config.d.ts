import { DiyTemplateConfig } from './types';
/**
 * 解析模板 config jsonb（规格 §5.2/§8）：
 * - 坏结构 / 缺关键字段（slots 非空数组且每个 slot 有 key/role/quantityMode/required、
 *   presentation.renderer 非空字符串）→ null，调用方逐级回退；
 * - params / constraints / presentation.blocks 缺省宽松补 []。
 */
export declare function parseTemplateConfig(input: unknown): DiyTemplateConfig | null;
