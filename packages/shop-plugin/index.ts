// merchant-permissions 必须最先导出：plugin.ts 会经 coupon-plugin 形成模块环，
// coupon 侧装饰器在环内读取 manageOwnShop.Permission，若本文件尚未执行到权限导出
// 则读到 undefined（Cannot read properties of undefined (reading 'Permission')）。
export * from './src/merchant-permissions';
export * from './src/plugin';
export * from './src/types';
export * from './src/constants';
export * from './src/shop.entity';
export * from './src/shop.service';
export * from './src/shop-custom-fields';