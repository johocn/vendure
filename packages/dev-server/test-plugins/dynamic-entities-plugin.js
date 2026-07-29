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
exports.DynamicEntitiesPlugin = exports.TestEntityB = exports.TestEntityA = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
let TestEntityA = class TestEntityA extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.TestEntityA = TestEntityA;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TestEntityA.prototype, "textA", void 0);
exports.TestEntityA = TestEntityA = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], TestEntityA);
let TestEntityB = class TestEntityB extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.TestEntityB = TestEntityB;
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TestEntityB.prototype, "textB", void 0);
exports.TestEntityB = TestEntityB = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], TestEntityB);
let DynamicEntitiesPlugin = class DynamicEntitiesPlugin {
    static init(options) {
        this.useEntity = options.useEntity;
        return this;
    }
};
exports.DynamicEntitiesPlugin = DynamicEntitiesPlugin;
exports.DynamicEntitiesPlugin = DynamicEntitiesPlugin = __decorate([
    (0, core_1.VendurePlugin)({
        entities: () => {
            return DynamicEntitiesPlugin.useEntity === 'A' ? [TestEntityA] : [TestEntityB];
        },
    })
], DynamicEntitiesPlugin);
//# sourceMappingURL=dynamic-entities-plugin.js.map