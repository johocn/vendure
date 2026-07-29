"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyEvent = void 0;
const vendure_entity_event_1 = require("../vendure-entity-event");
/**
 * @description
 * This event is fired whenever a {@link ApiKey} is added, updated or deleted.
 *
 * @docsCategory events
 * @docsPage Event Types
 * @since 3.6.0
 */
class ApiKeyEvent extends vendure_entity_event_1.VendureEntityEvent {
    constructor(ctx, entity, type, input) {
        super(entity, type, ctx, input);
    }
}
exports.ApiKeyEvent = ApiKeyEvent;
//# sourceMappingURL=api-key-event.js.map