"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// merchant-permissions 必须最先导出：plugin.ts 会经 coupon-plugin 形成模块环，
// coupon 侧装饰器在环内读取 manageOwnShop.Permission，若本文件尚未执行到权限导出
// 则读到 undefined（Cannot read properties of undefined (reading 'Permission')）。
__exportStar(require("./src/merchant-permissions"), exports);
__exportStar(require("./src/plugin"), exports);
__exportStar(require("./src/types"), exports);
__exportStar(require("./src/constants"), exports);
__exportStar(require("./src/shop.entity"), exports);
__exportStar(require("./src/shop.service"), exports);
__exportStar(require("./src/shop-custom-fields"), exports);
//# sourceMappingURL=index.js.map