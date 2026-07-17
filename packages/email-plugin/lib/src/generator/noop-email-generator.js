"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopEmailGenerator = void 0;
/**
 * Simply passes through the subject and template content without modification.
 */
class NoopEmailGenerator {
    generate(from, subject, body, templateVars) {
        return { from, subject, body };
    }
}
exports.NoopEmailGenerator = NoopEmailGenerator;
//# sourceMappingURL=noop-email-generator.js.map