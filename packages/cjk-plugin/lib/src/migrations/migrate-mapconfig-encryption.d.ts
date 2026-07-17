import { ChannelService } from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const MAP_CONFIG_MIGRATION_DONE = "MAP_CONFIG_MIGRATION_DONE";
export declare class MapConfigEncryptionMigration implements OnApplicationBootstrap {
    private connection;
    private channelService;
    constructor(connection: Connection, channelService: ChannelService);
    onApplicationBootstrap(): Promise<void>;
}
