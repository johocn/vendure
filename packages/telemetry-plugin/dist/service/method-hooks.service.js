"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MethodHooksService = void 0;
exports.registerMethodHooks = registerMethodHooks;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
/**
 * @description
 * Allows you to register hooks for a specific method of an instrumented class.
 * These hooks allow extra telemetry actions to be performed on the method.
 *
 * They can then be passed to the {@link TelemetryPlugin} via the {@link TelemetryPluginOptions}.
 *
 * @example
 * ```typescript
 * const productServiceHooks = registerMethodHooks(ProductService, {
 *     findOne: {
 *         // This will be called before the method is executed
 *         pre: ({ args: [ctx, productId], span }) => {
 *             span.setAttribute('productId', productId);
 *         },
 *         // This will be called after the method is executed
 *         post: ({ result, span }) => {
 *             span.setAttribute('found', !!result);
 *         },
 *     },
 * });
 * ```
 *
 * @since 3.3.0
 * @docsCategory core plugins/TelemetryPlugin
 */
function registerMethodHooks(target, hooks) {
    return {
        target,
        hooks,
    };
}
let MethodHooksService = class MethodHooksService {
    constructor() {
        this.hooksMap = new Map();
    }
    registerHooks(target, hooks) {
        const instrumentedClassTarget = (0, core_1.getInstrumentedClassTarget)(target);
        if (!instrumentedClassTarget) {
            core_1.Logger.error(`Cannot register hooks for non-instrumented class: ${target.name}`);
            return;
        }
        const existingHooks = this.hooksMap.get(instrumentedClassTarget);
        const combinedHooks = Object.assign(Object.assign({}, existingHooks), hooks);
        this.hooksMap.set(instrumentedClassTarget, combinedHooks);
    }
    getHooks(target, methodName) {
        var _a;
        return (_a = this.hooksMap.get(target)) === null || _a === void 0 ? void 0 : _a[methodName];
    }
};
exports.MethodHooksService = MethodHooksService;
exports.MethodHooksService = MethodHooksService = __decorate([
    (0, common_1.Injectable)()
], MethodHooksService);
//# sourceMappingURL=method-hooks.service.js.map