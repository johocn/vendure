import { Plugin } from 'vite';
export type FieldInfoTuple = readonly [
    type: string,
    nullable: boolean,
    list: boolean,
    isPaginatedList: boolean
];
export interface SchemaInfo {
    types: {
        [typename: string]: {
            [fieldname: string]: FieldInfoTuple;
        };
    };
    inputs: {
        [typename: string]: {
            [fieldname: string]: FieldInfoTuple;
        };
    };
    scalars: string[];
    enums: {
        [typename: string]: string[];
    };
}
export declare function adminApiSchemaPlugin(): Plugin;
