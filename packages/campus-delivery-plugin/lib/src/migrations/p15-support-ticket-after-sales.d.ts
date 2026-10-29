import { OnApplicationBootstrap } from '@nestjs/common';
import { Connection } from 'typeorm';
export declare const p15SupportTicketAfterSalesSql = "\nALTER TABLE campus_support_ticket ADD COLUMN IF NOT EXISTS \"orderId\" int;\nALTER TABLE campus_support_ticket ADD COLUMN IF NOT EXISTS \"afterSalesRequestId\" int;\nCREATE INDEX IF NOT EXISTS idx_campus_support_ticket_aftersales ON campus_support_ticket (\"afterSalesRequestId\");\n";
export declare class P15SupportTicketAfterSalesMigration implements OnApplicationBootstrap {
    private connection;
    constructor(connection: Connection);
    onApplicationBootstrap(): Promise<void>;
}
