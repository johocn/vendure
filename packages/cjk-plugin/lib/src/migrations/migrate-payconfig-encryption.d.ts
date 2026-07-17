import { ChannelService } from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const PAY_CONFIG_MIGRATION_DONE = "PAY_CONFIG_MIGRATION_DONE";
export declare class PayConfigEncryptionMigration implements OnApplicationBootstrap {
    private connection;
    private channelService;
    constructor(connection: Connection, channelService: ChannelService);
    onApplicationBootstrap(): Promise<void>;
    private needsEncryption;
}
