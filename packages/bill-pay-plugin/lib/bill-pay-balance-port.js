"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBillPayBalancePort = setBillPayBalancePort;
exports.getBillPayBalancePort = getBillPayBalancePort;
let port = null;
function setBillPayBalancePort(p) {
    port = p;
}
function getBillPayBalancePort() {
    return port;
}
//# sourceMappingURL=bill-pay-balance-port.js.map