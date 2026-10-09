import { Inject, Type } from '@nestjs/common';
import { PluginCommonModule, VendurePlugin } from '@vendure/core';

import { TCM_PLUGIN_OPTIONS } from './constants';
import { TcmClinic } from './entities/tcm-clinic.entity';
import { TcmClinicStaff } from './entities/tcm-clinic-staff.entity';
import { TcmEncounter } from './entities/tcm-encounter.entity';
import { TcmPatientProfile } from './entities/tcm-patient-profile.entity';
import { TcmAdminResolver } from './resolvers/tcm-admin.resolver';
import { TcmClinicService } from './services/tcm-clinic.service';
import { TcmEncounterService } from './services/tcm-encounter.service';
import { TcmStaffService } from './services/tcm-staff.service';
import { TcmClinicPluginOptions } from './types';

const { gql } = require('graphql-tag');

const adminSchema = () => gql`
    type TcmClinic {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        name: String!
        licenseNo: String!
        address: String
        status: String!
    }
    input TcmClinicInput {
        name: String!
        licenseNo: String!
        address: String
    }
    extend type Query {
        clinics(options: TcmClinicListOptions): TcmClinicList!
    }
    input TcmClinicListOptions {
        skip: Int
        take: Int
    }
    type TcmClinicList {
        items: [TcmClinic!]!
        totalItems: Int!
    }
    type TcmClinicStaff {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        administratorId: ID!
        clinicId: ID!
        role: String!
        displayName: String!
    }
    input TcmClinicStaffInput {
        clinicId: Int!
        administratorId: Int!
        displayName: String!
        role: String
    }
    type TcmPatientProfile {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        customerId: ID!
        clinicId: ID!
        constitution: JSON
    }
    input TcmPatientProfileInput {
        clinicId: Int!
        customerId: Int!
        constitution: JSON
    }
    type TcmEncounter {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        patientProfileId: ID!
        clinicId: ID!
        staffId: ID!
        type: String!
        status: String!
        version: Int!
    }
    input TcmEncounterInput {
        patientProfileId: Int!
        clinicId: Int!
        type: String
    }
    extend type Mutation {
        createClinic(input: TcmClinicInput!): TcmClinic!
        createClinicStaff(input: TcmClinicStaffInput!): TcmClinicStaff!
        createPatientProfile(input: TcmPatientProfileInput!): TcmPatientProfile!
        createEncounter(input: TcmEncounterInput!): TcmEncounter!
        startEncounter(id: ID!): TcmEncounter!
        completeEncounter(id: ID!): TcmEncounter!
    }
`;

@VendurePlugin({
    imports: [PluginCommonModule],
    entities: [TcmClinic, TcmClinicStaff, TcmPatientProfile, TcmEncounter],
    providers: [
        { provide: TCM_PLUGIN_OPTIONS, useFactory: () => TcmClinicPlugin.options },
        TcmClinicService,
        TcmStaffService,
        TcmEncounterService,
    ],
    adminApiExtensions: {
        schema: adminSchema,
        resolvers: [TcmAdminResolver],
    },
    compatibility: '^3.0.0',
})
export class TcmClinicPlugin {
    static options: TcmClinicPluginOptions = {};

    static init(options?: TcmClinicPluginOptions): Type<TcmClinicPlugin> {
        TcmClinicPlugin.options = options ?? {};
        return TcmClinicPlugin;
    }
}
