import { Customer, CustomerService, RequestContext, TransactionalConnection } from '@vendure/core';
import { TcmClinic } from '../entities/tcm-clinic.entity';
import { TcmClinicStaff } from '../entities/tcm-clinic-staff.entity';
import { TcmPatientProfile } from '../entities/tcm-patient-profile.entity';
export interface CreateClinicInput {
    name: string;
    licenseNo: string;
    address?: string;
}
export declare class TcmClinicService {
    private connection;
    private customerService;
    constructor(connection: TransactionalConnection, customerService: CustomerService);
    createClinic(ctx: RequestContext, input: CreateClinicInput): Promise<TcmClinic>;
    findAll(ctx: RequestContext): Promise<TcmClinic[]>;
    findOne(ctx: RequestContext, id: number): Promise<TcmClinic | null>;
    createClinicStaff(ctx: RequestContext, input: {
        clinicId: number;
        administratorId: number;
        displayName: string;
        role?: string;
    }): Promise<TcmClinicStaff>;
    createPatientProfile(ctx: RequestContext, input: {
        clinicId: number;
        customerId: number;
        constitution?: Record<string, any>;
    }): Promise<TcmPatientProfile>;
    findPatientProfile(ctx: RequestContext, id: number): Promise<TcmPatientProfile | null>;
    /** 按 User id 找关联客户（Shop API 归属校验第一步） */
    findCustomerByUserId(ctx: RequestContext, userId: number): Promise<Customer | null>;
    /** 按 Customer id 找患者档案（Shop API 归属校验第二步） */
    findProfileByCustomerId(ctx: RequestContext, customerId: number): Promise<TcmPatientProfile | null>;
}
