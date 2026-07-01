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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallationIdCollector = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const request_context_1 = require("../../api/common/request-context");
const settings_store_types_1 = require("../../config/settings-store/settings-store-types");
const transactional_connection_1 = require("../../connection/transactional-connection");
const settings_store_service_1 = require("../../service/helpers/settings-store/settings-store.service");
const SETTINGS_KEY = 'telemetry.installationId';
/**
 * Manages a persistent installation ID for telemetry purposes.
 * The ID is a random UUID stored primarily in the database via SettingsStoreService,
 * with a filesystem fallback at .vendure/.installation-id for when the DB is unavailable.
 *
 * Using the database ensures the installation ID persists across container restarts
 * in containerized deployments (Docker, K8s).
 */
let InstallationIdCollector = class InstallationIdCollector {
    constructor(settingsStoreService, connection) {
        this.settingsStoreService = settingsStoreService;
        this.connection = connection;
    }
    onModuleInit() {
        this.settingsStoreService.register({
            namespace: 'telemetry',
            fields: [{ name: 'installationId', scope: settings_store_types_1.SettingsStoreScopes.global, readonly: true }],
        });
    }
    /**
     * Returns the installation ID, creating one if it doesn't exist.
     * Checks DB first, then filesystem, then generates a new one.
     */
    async collect() {
        if (this.cachedId) {
            return this.cachedId;
        }
        // 1. Try database
        const dbId = await this.readFromDatabase();
        if (dbId) {
            this.cachedId = dbId;
            return dbId;
        }
        // 2. Try filesystem
        const fsId = this.readFromFilesystem();
        if (fsId) {
            // Migrate filesystem ID to database
            await this.saveToDatabase(fsId);
            this.cachedId = fsId;
            return fsId;
        }
        // 3. Generate new ID
        const newId = node_crypto_1.default.randomUUID();
        await this.saveToDatabase(newId);
        this.saveToFilesystem(newId);
        this.cachedId = newId;
        return newId;
    }
    async readFromDatabase() {
        var _a;
        try {
            if (!((_a = this.connection.rawConnection) === null || _a === void 0 ? void 0 : _a.isInitialized)) {
                return undefined;
            }
            const value = await this.settingsStoreService.get(request_context_1.RequestContext.empty(), SETTINGS_KEY);
            if (typeof value === 'string' && this.isValidUUID(value)) {
                return value;
            }
            return undefined;
        }
        catch (_b) {
            return undefined;
        }
    }
    async saveToDatabase(id) {
        var _a;
        try {
            if (!((_a = this.connection.rawConnection) === null || _a === void 0 ? void 0 : _a.isInitialized)) {
                return;
            }
            await this.settingsStoreService.set(request_context_1.RequestContext.empty(), SETTINGS_KEY, id);
        }
        catch (_b) {
            // Best-effort: silently ignore DB write failures
        }
    }
    readFromFilesystem() {
        try {
            const idPath = this.getInstallationIdPath();
            if (node_fs_1.default.existsSync(idPath)) {
                const existingId = node_fs_1.default.readFileSync(idPath, 'utf-8').trim();
                if (existingId && this.isValidUUID(existingId)) {
                    return existingId;
                }
            }
            return undefined;
        }
        catch (_a) {
            return undefined;
        }
    }
    saveToFilesystem(id) {
        try {
            const idPath = this.getInstallationIdPath();
            const vendureDir = node_path_1.default.dirname(idPath);
            node_fs_1.default.mkdirSync(vendureDir, { recursive: true });
            node_fs_1.default.writeFileSync(idPath, id, 'utf-8');
        }
        catch (_a) {
            // Best-effort: silently ignore filesystem write failures
        }
    }
    getInstallationIdPath() {
        // Find the project root by looking for node_modules
        let currentDir = process.cwd();
        // Walk up to find project root (where node_modules is)
        while (currentDir !== node_path_1.default.dirname(currentDir)) {
            if (node_fs_1.default.existsSync(node_path_1.default.join(currentDir, 'node_modules'))) {
                return node_path_1.default.join(currentDir, '.vendure', '.installation-id');
            }
            currentDir = node_path_1.default.dirname(currentDir);
        }
        // Fallback to cwd
        return node_path_1.default.join(process.cwd(), '.vendure', '.installation-id');
    }
    isValidUUID(str) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }
};
exports.InstallationIdCollector = InstallationIdCollector;
exports.InstallationIdCollector = InstallationIdCollector = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [settings_store_service_1.SettingsStoreService,
        transactional_connection_1.TransactionalConnection])
], InstallationIdCollector);
//# sourceMappingURL=installation-id.collector.js.map