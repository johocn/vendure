"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalAssetStorageStrategy = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
/**
 * @description
 * A persistence strategy which saves files to the local file system.
 *
 * @docsCategory core plugins/AssetServerPlugin
 */
class LocalAssetStorageStrategy {
    constructor(uploadPath, toAbsoluteUrlFn) {
        this.uploadPath = uploadPath;
        this.toAbsoluteUrlFn = toAbsoluteUrlFn;
        fs_extra_1.default.ensureDirSync(this.uploadPath);
        if (toAbsoluteUrlFn) {
            this.toAbsoluteUrl = toAbsoluteUrlFn;
        }
    }
    async writeFileFromStream(fileName, data, encoding) {
        const filePath = path_1.default.join(this.uploadPath, fileName);
        await fs_extra_1.default.ensureDir(path_1.default.dirname(filePath));
        const writeStream = fs_extra_1.default.createWriteStream(filePath, encoding === undefined ? 'binary' : encoding === null ? undefined : encoding);
        return new Promise((resolve, reject) => {
            data.pipe(writeStream);
            writeStream.on('close', () => resolve(this.filePathToIdentifier(filePath)));
            writeStream.on('error', reject);
        });
    }
    async writeFileFromBuffer(fileName, data) {
        const filePath = path_1.default.join(this.uploadPath, fileName);
        await fs_extra_1.default.ensureDir(path_1.default.dirname(filePath));
        await fs_extra_1.default.writeFile(filePath, data, 'binary');
        return this.filePathToIdentifier(filePath);
    }
    fileExists(fileName) {
        return new Promise(resolve => {
            fs_extra_1.default.access(this.identifierToFilePath(fileName), fs_extra_1.default.constants.F_OK, err => {
                resolve(!err);
            });
        });
    }
    readFileToBuffer(identifier) {
        return fs_extra_1.default.readFile(this.identifierToFilePath(identifier));
    }
    readFileToStream(identifier, encoding) {
        const readStream = fs_extra_1.default.createReadStream(this.identifierToFilePath(identifier), encoding === undefined ? 'binary' : encoding === null ? undefined : encoding);
        return Promise.resolve(readStream);
    }
    deleteFile(identifier) {
        return fs_extra_1.default.unlink(this.identifierToFilePath(identifier));
    }
    filePathToIdentifier(filePath) {
        const filePathDirname = path_1.default.dirname(filePath);
        const deltaDirname = filePathDirname.replace(this.uploadPath, '');
        const identifier = path_1.default.join(deltaDirname, path_1.default.basename(filePath));
        return identifier.replace(/^[\\/]+/, '');
    }
    identifierToFilePath(identifier) {
        return path_1.default.join(this.uploadPath, identifier);
    }
}
exports.LocalAssetStorageStrategy = LocalAssetStorageStrategy;
//# sourceMappingURL=local-asset-storage-strategy.js.map