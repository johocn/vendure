import { PermissionDefinition } from '@vendure/core';

/** 能盘：建任务 / 拆盘次 / 认领 / 录入 / 提交 */
export const StocktakeCountPermission = new PermissionDefinition({
    name: 'StocktakeCount',
    description: '多人协同盘库：建任务、拆盘次、认领、录入、提交',
});

/** 能过账：差异复核 + 一键过账（与「能盘」刻意分开，规格 §9） */
export const StocktakePostPermission = new PermissionDefinition({
    name: 'StocktakePost',
    description: '多人协同盘库：差异复核与过账',
});

export const stocktakePermissionDefinitions = [StocktakeCountPermission, StocktakePostPermission];