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
exports.TcmEncounterService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const tcm_encounter_entity_1 = require("../entities/tcm-encounter.entity");
const TRANSITIONS = {
    PENDING: ['ACTIVE'],
    ACTIVE: ['COMPLETED'],
    COMPLETED: [],
};
let TcmEncounterService = class TcmEncounterService {
    constructor(connection) {
        this.connection = connection;
    }
    async create(ctx, input, staffId) {
        var _a;
        const repo = this.connection.getRepository(ctx, tcm_encounter_entity_1.TcmEncounter);
        const open = await repo.findOne({
            where: { patientProfileId: input.patientProfileId, status: 'PENDING' },
        });
        const openActive = open !== null && open !== void 0 ? open : (await repo.findOne({
            where: { patientProfileId: input.patientProfileId, status: 'ACTIVE' },
        }));
        if (openActive) {
            throw new core_1.UserInputError('该患者已有未完成接诊');
        }
        return repo.save(new tcm_encounter_entity_1.TcmEncounter(Object.assign(Object.assign({}, input), { staffId, type: (_a = input.type) !== null && _a !== void 0 ? _a : 'initial', status: 'PENDING' })));
    }
    async transition(ctx, id, to) {
        const repo = this.connection.getRepository(ctx, tcm_encounter_entity_1.TcmEncounter);
        const encounter = await repo.findOne({ where: { id } });
        if (!encounter) {
            throw new core_1.UserInputError(`接诊不存在：${id}`);
        }
        if (!TRANSITIONS[encounter.status].includes(to)) {
            throw new core_1.IllegalOperationError(`非法状态迁移：${encounter.status} → ${to}`);
        }
        encounter.status = to;
        return repo.save(encounter); // VersionColumn 触发乐观锁
    }
};
exports.TcmEncounterService = TcmEncounterService;
exports.TcmEncounterService = TcmEncounterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.TransactionalConnection])
], TcmEncounterService);
//# sourceMappingURL=tcm-encounter.service.js.map