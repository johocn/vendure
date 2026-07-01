"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemInfoCollector = void 0;
const common_1 = require("@nestjs/common");
const node_os_1 = __importDefault(require("node:os"));
/**
 * Collects basic system information for telemetry.
 */
let SystemInfoCollector = class SystemInfoCollector {
    collect() {
        return {
            nodeVersion: process.version,
            platform: `${node_os_1.default.platform()} ${node_os_1.default.arch()}`,
        };
    }
};
exports.SystemInfoCollector = SystemInfoCollector;
exports.SystemInfoCollector = SystemInfoCollector = __decorate([
    (0, common_1.Injectable)()
], SystemInfoCollector);
//# sourceMappingURL=system-info.collector.js.map