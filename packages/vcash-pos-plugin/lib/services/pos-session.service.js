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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PosSessionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@vendure/core");
const typeorm_2 = require("typeorm");
const pos_session_entity_1 = require("../entities/pos-session.entity");
const pos_terminal_service_1 = require("./pos-terminal.service");
const shift_report_service_1 = require("./shift-report.service");
/**
 * 班次生命周期服务：
 * - 开班：校验终端 active + 无 open session → 生成 session code → 持久化
 * - 关班：校验 session open → 调用 ShiftReportService 生成 closeSummary → 标记 closed
 * - 查询：findOpenSession / findMySession / findOne
 *
 * closeSession 若未显式传入 closeSummary，则调用 ShiftReportService 自动生成。
 */
let PosSessionService = class PosSessionService {
    constructor(connection, terminalService, shiftReportService) {
        this.connection = connection;
        this.terminalService = terminalService;
        this.shiftReportService = shiftReportService;
    }
    /**
     * 开班。同一终端同时仅允许一个 open 状态 session。
     */
    async openSession(input) {
        var _a;
        const terminal = await this.terminalService.findByCode(input.terminalCode);
        if (!terminal) {
            throw new core_1.UserInputError(`终端 ${input.terminalCode} 不存在`);
        }
        if (!terminal.active) {
            throw new core_1.UserInputError(`终端 ${input.terminalCode} 已停用`);
        }
        const existing = await this.findOpenSession(terminal.id);
        if (existing) {
            throw new core_1.UserInputError(`终端 ${input.terminalCode} 已有开着的班次 ${existing.code}`);
        }
        const code = await this.generateSessionCode();
        const session = new pos_session_entity_1.PosSession();
        session.code = code;
        session.terminal = terminal;
        session.stockLocation = terminal.stockLocation;
        session.operator = { id: input.operatorId };
        session.state = 'open';
        session.openingFloat = (_a = input.openingFloat) !== null && _a !== void 0 ? _a : 0;
        session.activeOrderId = null;
        const saved = await this.connection.getRepository(pos_session_entity_1.PosSession).save(session);
        const reloaded = await this.findOne(saved.id);
        if (!reloaded) {
            throw new Error(`班次 ${saved.id} 创建后查询失败`);
        }
        return reloaded;
    }
    /**
     * 关班。若未显式传入 closeSummary，则调用 ShiftReportService 自动生成
     * （会基于 closingCash 进行现金对账并产出 warnings）。
     */
    async closeSession(input) {
        var _a;
        const session = await this.findOne(input.sessionId);
        if (!session) {
            throw new core_1.UserInputError(`班次 ${input.sessionId} 不存在`);
        }
        if (session.state !== 'open') {
            throw new core_1.UserInputError(`班次 ${session.code} 已关闭`);
        }
        const closingCash = (_a = input.closingCash) !== null && _a !== void 0 ? _a : 0;
        // 未传 closeSummary 时自动生成（传入 closingCash 触发现金对账）
        const summary = input.closeSummary !== undefined
            ? input.closeSummary
            : await this.shiftReportService.generateSummary(input.sessionId, closingCash);
        session.state = 'closed';
        session.closedAt = new Date();
        session.closingCash = closingCash;
        session.closeSummary = summary;
        if (input.approverId) {
            session.approver = { id: input.approverId };
        }
        session.activeOrderId = null;
        return this.connection.getRepository(pos_session_entity_1.PosSession).save(session);
    }
    async findOpenSession(terminalId) {
        return this.connection.getRepository(pos_session_entity_1.PosSession).findOne({
            where: { terminal: { id: terminalId }, state: 'open' },
            relations: ['terminal', 'operator', 'stockLocation', 'customer'],
        });
    }
    async findMyOpenSession(operatorId) {
        return this.connection.getRepository(pos_session_entity_1.PosSession).findOne({
            where: { operator: { id: operatorId }, state: 'open' },
            relations: ['terminal', 'operator', 'stockLocation', 'customer'],
        });
    }
    async findOne(id) {
        return this.connection.getRepository(pos_session_entity_1.PosSession).findOne({
            where: { id },
            relations: ['terminal', 'operator', 'approver', 'stockLocation', 'customer'],
        });
    }
    /**
     * 保存 session 变更（绑定/解绑会员、activeOrderId 变更等）。
     */
    async save(session) {
        const saved = await this.connection.getRepository(pos_session_entity_1.PosSession).save(session);
        const reloaded = await this.findOne(saved.id);
        if (!reloaded)
            throw new Error(`班次 ${saved.id} 保存后查询失败`);
        return reloaded;
    }
    /**
     * 生成班次号：S{YYYYMMDD}-{3位序号}。序号按当天已有 session 数 +1 推算。
     */
    async generateSessionCode() {
        const dateStr = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, '');
        const prefix = `S${dateStr}-`;
        const count = await this.connection
            .getRepository(pos_session_entity_1.PosSession)
            .count({ where: { code: (0, typeorm_2.Like)(`${prefix}%`) } });
        return `${prefix}${String(count + 1).padStart(3, '0')}`;
    }
};
exports.PosSessionService = PosSessionService;
exports.PosSessionService = PosSessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectConnection)()),
    __param(1, (0, common_1.Inject)(pos_terminal_service_1.PosTerminalService)),
    __param(2, (0, common_1.Inject)(shift_report_service_1.ShiftReportService)),
    __metadata("design:paramtypes", [typeorm_2.Connection,
        pos_terminal_service_1.PosTerminalService,
        shift_report_service_1.ShiftReportService])
], PosSessionService);
//# sourceMappingURL=pos-session.service.js.map