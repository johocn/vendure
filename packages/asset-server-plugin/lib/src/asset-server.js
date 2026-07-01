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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetServer = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@vendure/core");
const crypto_1 = require("crypto");
const express_1 = __importDefault(require("express"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const common_2 = require("./common");
const s3_asset_storage_strategy_1 = require("./config/s3-asset-storage-strategy");
const constants_1 = require("./constants");
const transform_image_1 = require("./transform-image");
async function getFileType(buffer) {
    const { fileTypeFromBuffer } = await import('file-type');
    return fileTypeFromBuffer(buffer);
}
/**
 * This houses the actual Express server that handles incoming requests, performs image transformations,
 * caches the results, and serves the transformed images.
 */
let AssetServer = class AssetServer {
    constructor(options, configService, processContext) {
        this.options = options;
        this.configService = configService;
        this.processContext = processContext;
        this.cacheDir = 'cache';
        this.assetStorageStrategy = this.configService.assetOptions.assetStorageStrategy;
    }
    /** @internal */
    onApplicationBootstrap() {
        if (this.processContext.isWorker) {
            return;
        }
        // Configure Cache-Control header
        const { cacheHeader } = this.options;
        if (!cacheHeader) {
            this.cacheHeader = constants_1.DEFAULT_CACHE_HEADER;
        }
        else {
            if (typeof cacheHeader === 'string') {
                this.cacheHeader = cacheHeader;
            }
            else {
                this.cacheHeader = [cacheHeader.restriction, `max-age: ${cacheHeader.maxAge}`]
                    .filter(value => !!value)
                    .join(', ');
            }
        }
        const cachePath = path_1.default.join(this.options.assetUploadDir, this.cacheDir);
        fs_extra_1.default.ensureDirSync(cachePath);
    }
    /**
     * Creates the image server instance
     */
    createAssetServer(serverConfig) {
        this.presets = serverConfig.presets;
        this.imageTransformStrategies = serverConfig.imageTransformStrategies;
        const assetServer = express_1.default.Router();
        assetServer.use(this.sendAsset(), this.generateTransformedImage());
        return assetServer;
    }
    /**
     * Reads the file requested and send the response to the browser.
     */
    sendAsset() {
        return async (req, res, next) => {
            var _a;
            let params;
            try {
                params = await this.getImageTransformParameters(req);
            }
            catch (e) {
                core_1.Logger.error(e.message, constants_1.loggerCtx);
                res.status(400).send('Invalid parameters');
                return;
            }
            const key = this.getFileNameFromParameters(req.path, params);
            try {
                const file = await this.assetStorageStrategy.readFileToBuffer(key);
                let mimeType = this.getMimeType(key);
                if (!mimeType) {
                    mimeType = ((_a = (await getFileType(file))) === null || _a === void 0 ? void 0 : _a.mime) || 'application/octet-stream';
                }
                res.contentType(mimeType);
                res.setHeader('content-security-policy', "default-src 'self'");
                res.setHeader('Cache-Control', this.cacheHeader);
                res.send(file);
            }
            catch (e) {
                const err = new Error('File not found');
                err.status = 404;
                return next(err);
            }
        };
    }
    /**
     * If an exception was thrown by the first handler, then it may be because a transformed image
     * is being requested which does not yet exist. In this case, this handler will generate the
     * transformed image, save it to cache, and serve the result as a response.
     */
    generateTransformedImage() {
        return async (err, req, res, next) => {
            var _a;
            if (err && (err.status === 404 || err.statusCode === 404)) {
                if (req.query) {
                    const decodedReqPath = this.sanitizeFilePath(req.path);
                    core_1.Logger.debug(`Pre-cached Asset not found: ${decodedReqPath}`, constants_1.loggerCtx);
                    let file;
                    try {
                        file = await this.assetStorageStrategy.readFileToBuffer(decodedReqPath);
                    }
                    catch (_err) {
                        res.status(404).send('Resource not found');
                        return;
                    }
                    try {
                        const parameters = await this.getImageTransformParameters(req);
                        const image = await (0, transform_image_1.transformImage)(file, parameters);
                        const imageBuffer = await image.toBuffer();
                        const cachedFileName = this.getFileNameFromParameters(req.path, parameters);
                        if (!req.query.cache || req.query.cache === 'true') {
                            await this.assetStorageStrategy.writeFileFromBuffer(cachedFileName, imageBuffer);
                            core_1.Logger.debug(`Saved cached asset: ${cachedFileName}`, constants_1.loggerCtx);
                        }
                        let mimeType = this.getMimeType(cachedFileName);
                        if (!mimeType) {
                            mimeType = ((_a = (await getFileType(imageBuffer))) === null || _a === void 0 ? void 0 : _a.mime) || 'image/jpeg';
                        }
                        res.set('Content-Type', mimeType);
                        res.setHeader('content-security-policy', "default-src 'self'");
                        res.send(imageBuffer);
                        return;
                    }
                    catch (e) {
                        core_1.Logger.error(e.message, constants_1.loggerCtx, e.stack);
                        res.status(500).send('An error occurred when generating the image');
                        return;
                    }
                }
            }
            next();
        };
    }
    async getImageTransformParameters(req) {
        let parameters = this.getInitialImageTransformParameters(req.query);
        for (const strategy of this.imageTransformStrategies) {
            try {
                parameters = await strategy.getImageTransformParameters({
                    req,
                    input: Object.assign({}, parameters),
                    availablePresets: this.presets,
                });
            }
            catch (e) {
                core_1.Logger.error(`Error applying ImageTransformStrategy: ` + e.message, constants_1.loggerCtx);
                throw e;
            }
        }
        let targetWidth = parameters.width;
        let targetHeight = parameters.height;
        let targetMode = parameters.mode;
        if (parameters.preset) {
            const matchingPreset = this.presets.find(p => p.name === parameters.preset);
            if (matchingPreset) {
                targetWidth = matchingPreset.width;
                targetHeight = matchingPreset.height;
                targetMode = matchingPreset.mode;
            }
        }
        return Object.assign(Object.assign({}, parameters), { width: targetWidth, height: targetHeight, mode: targetMode });
    }
    getInitialImageTransformParameters(queryParams) {
        const width = Math.round(+queryParams.w) || undefined;
        const height = Math.round(+queryParams.h) || undefined;
        const quality = queryParams.q != null ? Math.round(Math.max(Math.min(+queryParams.q, 100), 1)) : undefined;
        const mode = queryParams.mode === 'resize' ? 'resize' : 'crop';
        const fpx = +queryParams.fpx || undefined;
        const fpy = +queryParams.fpy || undefined;
        const format = (0, common_2.getValidFormat)(queryParams.format);
        return {
            width,
            height,
            quality,
            format,
            mode,
            fpx,
            fpy,
            preset: queryParams.preset,
        };
    }
    getFileNameFromParameters(filePath, params) {
        const { width: w, height: h, mode, preset, fpx, fpy, format, quality: q } = params;
        /* eslint-disable @typescript-eslint/restrict-template-expressions */
        const focalPoint = fpx && fpy ? `_fpx${fpx}_fpy${fpy}` : '';
        const quality = q ? `_q${q}` : '';
        const imageFormat = (0, common_2.getValidFormat)(format);
        let imageParamsString = '';
        if (w || h) {
            const width = w || '';
            const height = h || '';
            imageParamsString = `_transform_w${width}_h${height}_m${mode}`;
        }
        else if (preset) {
            if (this.presets && !!this.presets.find(p => p.name === preset)) {
                imageParamsString = `_transform_pre_${preset}`;
            }
        }
        if (focalPoint) {
            imageParamsString += focalPoint;
        }
        if (imageFormat) {
            imageParamsString += imageFormat;
        }
        if (quality) {
            imageParamsString += quality;
        }
        const decodedReqPath = this.sanitizeFilePath(filePath);
        if (imageParamsString !== '') {
            const imageParamHash = this.md5(imageParamsString);
            return path_1.default.join(this.cacheDir, this.addSuffix(decodedReqPath, imageParamHash, imageFormat));
        }
        else {
            return decodedReqPath;
        }
    }
    /**
     * Sanitize the file path to prevent directory traversal attacks.
     */
    sanitizeFilePath(filePath) {
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(filePath);
        }
        catch (e) {
            core_1.Logger.error(e.message + ': ' + filePath, constants_1.loggerCtx);
            return '';
        }
        if (this.assetStorageStrategy instanceof s3_asset_storage_strategy_1.S3AssetStorageStrategy) {
            // For S3 storage, we don't need to sanitize the path because
            // directory traversal attacks are not possible, and modifying the
            // path in this way can cause S3 files to be not found.
            return decodedPath;
        }
        else {
            // For local storage, we make sure to sanitize the path to prevent directory traversal attacks.
            const normalizedPath = path_1.default.normalize(decodedPath);
            let sanitizedPath = normalizedPath;
            let previousPath;
            do {
                previousPath = sanitizedPath;
                sanitizedPath = previousPath.replace(/(\.\.[\\/])+/g, '');
            } while (sanitizedPath !== previousPath);
            return sanitizedPath;
        }
    }
    md5(input) {
        return (0, crypto_1.createHash)('md5').update(input).digest('hex');
    }
    addSuffix(fileName, suffix, ext) {
        const originalExt = path_1.default.extname(fileName);
        const effectiveExt = ext ? `.${ext}` : originalExt;
        const baseName = path_1.default.basename(fileName, originalExt);
        const dirName = path_1.default.dirname(fileName);
        return path_1.default.join(dirName, `${baseName}${suffix}${effectiveExt}`);
    }
    /**
     * Attempt to get the mime type from the file name.
     */
    getMimeType(fileName) {
        const ext = path_1.default.extname(fileName);
        switch (ext) {
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            case '.png':
                return 'image/png';
            case '.gif':
                return 'image/gif';
            case '.svg':
                return 'image/svg+xml';
            case '.tiff':
                return 'image/tiff';
            case '.webp':
                return 'image/webp';
        }
    }
};
exports.AssetServer = AssetServer;
exports.AssetServer = AssetServer = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.ASSET_SERVER_PLUGIN_INIT_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.ConfigService,
        core_1.ProcessContext])
], AssetServer);
//# sourceMappingURL=asset-server.js.map