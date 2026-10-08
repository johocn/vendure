export const loggerCtx = 'PreSalePlugin';
export const PRE_SALE_PLUGIN_OPTIONS = Symbol('PRE_SALE_PLUGIN_OPTIONS');

/** 定金法定上限：主合同标的额 20%（民法典 §586；与 payment-schedule-plugin 各自持有，避免编译期耦合） */
export const LEGAL_DEPOSIT_CAP_RATIO = 0.2;