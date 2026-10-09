"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TcmAuditService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const tcm_audit_log_entity_1 = require("../entities/tcm-audit-log.entity");
let TcmAuditService = class TcmAuditService {
    constructor(connection) {
        this.connection = connection;
    }
    /** 与业务写操作同一 ctx 事务内调用 */
    async log(ctx, input) {
        await this.connection.getRepository(ctx, tcm_audit_log_entity_1.TcmAuditLog).save(new tcm_audit_log_entity_1.TcmAuditLog(input));
    }
    /** 只读分页查询 */
    async findAll(ctx, options = {}) {
        const [items, totalItems] = await this.connection
            .getRepository(ctx, tcm_audit_log_entity_1.TcmAuditLog)
            .findAndCount({ skip: options.skip, take: options.take, order: { id: 'ASC' } });
        return { items, totalItems };
    }
};
exports.TcmAuditService = TcmAuditService;
exports.TcmAuditService = TcmAuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], TcmAuditService);
//# sourceMappingURL=tcm-audit.service.js.map