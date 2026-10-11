import { DiyCategory } from './entities/diy-category.entity';
import { DiyMaterial } from './entities/diy-material.entity';
/**
 * 两层素材合并（规格 §4.2）：
 * - 起点 = 平台库全集；
 * - 租户复制行按 sourceMaterialId 精确覆盖同源平台行（完全接管价/库存）；
 * - 无回链的租户行按 code 覆盖同货号平台行；
 * - 结果 = 未被覆盖的平台行 + 全部租户行（顺序：平台在前、租户在后）。
 */
export declare function mergeMaterials(platform: DiyMaterial[], tenant: DiyMaterial[]): DiyMaterial[];
/** 两层分类合并（规格 §4.1）：纯并集、无覆盖；排序责任在查询侧（ORDER BY sortOrder） */
export declare function mergeCategories(platform: DiyCategory[], tenant: DiyCategory[]): DiyCategory[];
