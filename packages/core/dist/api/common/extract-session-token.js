"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSessionToken = extractSessionToken;
/**
 * Depending on the configured `tokenMethod`, tries to extract a session token in the order:
 *
 * 1. Cookie
 * 2. Authorization Header
 * 3. API-Key Header
 *
 * @see {@link AuthOptions}
 */
function extractSessionToken(req, tokenMethod, apiKeyHeaderKey) {
    var _a, _b, _c;
    if (((_a = req.session) === null || _a === void 0 ? void 0 : _a.token) && (tokenMethod === 'cookie' || tokenMethod.includes('cookie'))) {
        return { method: 'cookie', token: req.session.token };
    }
    const authHeader = (_b = req.get('Authorization')) === null || _b === void 0 ? void 0 : _b.trim();
    if (authHeader && (tokenMethod === 'bearer' || tokenMethod.includes('bearer'))) {
        const matchesBearer = authHeader.match(/^bearer\s(.+)$/i);
        if (matchesBearer) {
            return { method: 'bearer', token: matchesBearer[1] };
        }
    }
    // TODO: For some reason `apiKeyHeaderKey` is undefined on CI Server Smoke tests... (confirmed on 2025-12-07)
    // Maybe it has something to do with the package versions that get installed by the CI, I do not know.
    // Anyway, this simple check fixes this for now, let's try removing this again when versions change.
    if (!apiKeyHeaderKey)
        return;
    const apiKeyHeader = (_c = req.get(apiKeyHeaderKey)) === null || _c === void 0 ? void 0 : _c.trim();
    if (apiKeyHeader && tokenMethod.includes('api-key')) {
        return { method: 'api-key', token: apiKeyHeader };
    }
}
//# sourceMappingURL=extract-session-token.js.map