import { CustomFields } from '@vendure/core';
/**
 * 仓库性质与编码：
 * - kind: virtual=虚拟仓（网络销售可售源），physical=物理仓（真实库存）
 * - code: 租户内唯一标识。虚拟仓={tenantCode}-virtual；默认物理仓={tenantCode}；附加物理仓={tenantCode}-{alias}
 */
export declare const stockLocationCustomFields: CustomFields;
