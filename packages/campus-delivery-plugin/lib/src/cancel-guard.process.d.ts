import { OrderProcess } from '@vendure/core';
/**
 * 取消守卫：C 端（apiType=shop）在骑手已接单/取货、外部运单在途、商户自配送或已送达时禁止取消。
 * 后台（admin）强制取消不受影响：商家拒单、T4 无人接、运营异常处置仍需能取消。
 * 未取货（open/pending_dispatch/pending_merchant/accepted）仍允许用户取消，避免把未履约订单锁死。
 */
export declare const campusCancelGuardProcess: OrderProcess<any>;
