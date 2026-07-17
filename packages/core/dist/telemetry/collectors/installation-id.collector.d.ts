import { OnModuleInit } from '@nestjs/common';
import { TransactionalConnection } from '../../connection/transactional-connection';
import { SettingsStoreService } from '../../service/helpers/settings-store/settings-store.service';
/**
 * Manages a persistent installation ID for telemetry purposes.
 * The ID is a random UUID stored primarily in the database via SettingsStoreService,
 * with a filesystem fallback at .vendure/.installation-id for when the DB is unavailable.
 *
 * Using the database ensures the installation ID persists across container restarts
 * in containerized deployments (Docker, K8s).
 */
export declare class InstallationIdCollector implements OnModuleInit {
    private readonly settingsStoreService;
    private readonly connection;
    private cachedId;
    constructor(settingsStoreService: SettingsStoreService, connection: TransactionalConnection);
    onModuleInit(): void;
    /**
     * Returns the installation ID, creating one if it doesn't exist.
     * Checks DB first, then filesystem, then generates a new one.
     */
    collect(): Promise<string>;
    private readFromDatabase;
    private saveToDatabase;
    private readFromFilesystem;
    private saveToFilesystem;
    private getInstallationIdPath;
    private isValidUUID;
}
