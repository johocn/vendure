"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashedAssetNamingStrategy = void 0;
const core_1 = require("@vendure/core");
const crypto_1 = require("crypto");
const path_1 = __importDefault(require("path"));
/**
 * @description
 * An extension of the {@link DefaultAssetNamingStrategy} which prefixes file names with
 * the type (`'source'` or `'preview'`) as well as a 2-character sub-directory based on
 * the md5 hash of the original file name.
 *
 * This is an implementation of the technique knows as "hashed directory" file storage,
 * and the purpose is to reduce the number of files in a single directory, since a very large
 * number of files can lead to performance issues when reading and writing to that directory.
 *
 * With this strategy, even with 200,000 total assets stored, each directory would
 * only contain less than 800 files.
 *
 * @docsCategory core plugins/AssetServerPlugin
 */
class HashedAssetNamingStrategy extends core_1.DefaultAssetNamingStrategy {
    generateSourceFileName(ctx, originalFileName, conflictFileName) {
        const filename = super.generateSourceFileName(ctx, originalFileName, conflictFileName);
        return path_1.default.join('source', this.getHashedDir(filename), filename);
    }
    generatePreviewFileName(ctx, originalFileName, conflictFileName) {
        const filename = super.generatePreviewFileName(ctx, originalFileName, conflictFileName);
        return path_1.default.join('preview', this.getHashedDir(filename), filename);
    }
    getHashedDir(filename) {
        return (0, crypto_1.createHash)('md5').update(filename).digest('hex').slice(0, 2);
    }
}
exports.HashedAssetNamingStrategy = HashedAssetNamingStrategy;
//# sourceMappingURL=hashed-asset-naming-strategy.js.map