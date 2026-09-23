import { PermissionDefinition } from '@vendure/core';
/** 能盘：建任务 / 拆盘次 / 认领 / 录入 / 提交 */
export declare const StocktakeCountPermission: PermissionDefinition;
/** 能过账：差异复核 + 一键过账（与「能盘」刻意分开，规格 §9） */
export declare const StocktakePostPermission: PermissionDefinition;
export declare const stocktakePermissionDefinitions: PermissionDefinition[];
