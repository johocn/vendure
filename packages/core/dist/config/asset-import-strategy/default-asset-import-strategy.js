"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultAssetImportStrategy = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const path_1 = __importDefault(require("path"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const config_service_1 = require("../config.service");
const vendure_logger_1 = require("../logger/vendure-logger");
const assert_public_url_1 = require("./assert-public-url");
const loggerCtx = 'DefaultAssetImportStrategy';
const MAX_LOGGED_URL_LENGTH = 200;
function safeForLog(value) {
    return value.replace(/[\x00-\x1f\x7f]/g, '?').slice(0, MAX_LOGGED_URL_LENGTH);
}
/**
 * Issues an HTTP(S) GET for the asset. If `pinned` is provided, the request is
 * directed at that exact IP address with the original hostname preserved in the
 * `Host` header (and as the TLS SNI `servername` for HTTPS). This avoids a
 * second, independent DNS lookup that could resolve the hostname to a private
 * IP between {@link assertPublicUrl} validation and this fetch (DNS rebinding).
 *
 * The implementation deliberately does NOT follow redirects — Node's default.
 * Enabling redirect-following here would re-open the SSRF surface that this
 * file is meant to close, because the redirect target would bypass the
 * `assertPublicUrl` validation.
 */
function fetchUrl(url, pinned) {
    return new Promise((resolve, reject) => {
        const isHttps = url.protocol === 'https:';
        const get = isHttps ? https_1.default.get : http_1.default.get;
        const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
        // `url.host` preserves the port only when it is non-default, which is
        // exactly what we want for the Host header.
        const hostHeader = url.host;
        const requestOptions = pinned
            ? {
                host: pinned.address,
                port,
                path: `${url.pathname}${url.search}`,
                family: pinned.family,
                headers: { Host: hostHeader },
                timeout: 5000,
            }
            : {
                // No pinned IP: caller opted into `allowPrivateNetworks`, fall
                // back to the URL-driven path. Node performs its own DNS lookup
                // here, which is fine because the operator has accepted the
                // private-network risk.
                host: url.hostname,
                port,
                path: `${url.pathname}${url.search}`,
                headers: { Host: hostHeader },
                timeout: 5000,
            };
        if (isHttps && pinned) {
            requestOptions.servername = url.hostname;
        }
        get(requestOptions, res => {
            const { statusCode } = res;
            if (statusCode !== 200) {
                vendure_logger_1.Logger.error(`Failed to fetch "${safeForLog(url.toString())}", statusCode: ${statusCode !== null && statusCode !== void 0 ? statusCode : 'unknown'}`, loggerCtx);
                reject(new Error(`Request failed. Status code: ${statusCode !== null && statusCode !== void 0 ? statusCode : 'unknown'}`));
            }
            else {
                resolve(res);
            }
        }).on('error', err => reject(err));
    });
}
/**
 * @description
 * The DefaultAssetImportStrategy is able to import paths from the local filesystem (taking into account the
 * `importExportOptions.importAssetsDir` setting) as well as remote http/https urls.
 *
 * @since 1.7.0
 * @docsCategory import-export
 */
class DefaultAssetImportStrategy {
    constructor(options) {
        this.options = options;
    }
    init(injector) {
        this.configService = injector.get(config_service_1.ConfigService);
    }
    getStreamFromPath(assetPath) {
        if (/^https?:\/\//.test(assetPath)) {
            return this.getStreamFromUrl(assetPath);
        }
        else {
            return this.getStreamFromLocalFile(assetPath);
        }
    }
    async getStreamFromUrl(assetUrl) {
        var _a;
        const { retryCount, retryDelayMs, allowPrivateNetworks } = (_a = this.options) !== null && _a !== void 0 ? _a : {};
        const { url, pinned } = await (0, assert_public_url_1.assertPublicUrl)(assetUrl, { allowPrivateNetworks });
        return (0, rxjs_1.lastValueFrom)((0, rxjs_1.from)(fetchUrl(url, pinned)).pipe((0, operators_1.retryWhen)(errors => errors.pipe((0, operators_1.tap)(value => {
            vendure_logger_1.Logger.verbose(String(value), loggerCtx);
            vendure_logger_1.Logger.verbose(`retrying fetchUrl for ${safeForLog(assetUrl)}`, loggerCtx);
        }), (0, operators_1.delay)(retryDelayMs !== null && retryDelayMs !== void 0 ? retryDelayMs : 200), (0, operators_1.take)(retryCount !== null && retryCount !== void 0 ? retryCount : 3)))));
    }
    getStreamFromLocalFile(assetPath) {
        const { importAssetsDir } = this.configService.importExportOptions;
        const filename = path_1.default.join(importAssetsDir, assetPath);
        if (fs_extra_1.default.existsSync(filename)) {
            const fileStat = fs_extra_1.default.statSync(filename);
            if (fileStat.isFile()) {
                try {
                    const stream = fs_extra_1.default.createReadStream(filename);
                    return stream;
                }
                catch (err) {
                    throw err;
                }
            }
            else {
                throw new Error(`Could not find file "${filename}"`);
            }
        }
        else {
            throw new Error(`File "${filename}" does not exist`);
        }
    }
}
exports.DefaultAssetImportStrategy = DefaultAssetImportStrategy;
//# sourceMappingURL=default-asset-import-strategy.js.map