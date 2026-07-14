export { runStage, logStage, withCtx, yuanToCents } from './shared';
export type { StageResult } from './shared';

export { populateBase } from './01-base';
export { populateDefaultChannel } from './02-default-channel';
export { populateShopAChannel } from './03-shop-a-channel';
export { populatePromotions } from './04-promotions';
export { populateCustomers } from './05-customers';
export { populateOrders } from './06-orders';
export { populateFloors } from './07-floors';
