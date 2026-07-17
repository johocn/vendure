import { GraphQLList, GraphQLNonNull, GraphQLObjectType, isEnumType, isInputObjectType, isObjectType, isScalarType, } from 'graphql';
import { getConfigLoaderApi } from './vite-plugin-config-loader.js';
const virtualModuleId = 'virtual:admin-api-schema';
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
export function adminApiSchemaPlugin() {
    let configLoaderApi;
    let schemaInfo;
    return {
        name: 'vendure:admin-api-schema',
        configResolved({ plugins }) {
            configLoaderApi = getConfigLoaderApi(plugins);
        },
        async buildStart() {
            const { vendureConfig } = await configLoaderApi.getVendureConfig();
            if (!schemaInfo) {
                const { generateSchema } = await import('./utils/schema-generator.js');
                const safeSchema = await generateSchema({ vendureConfig });
                schemaInfo = generateSchemaInfo(safeSchema);
            }
        },
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        load(id) {
            if (id === resolvedVirtualModuleId) {
                return `
                    export const schemaInfo = ${JSON.stringify(schemaInfo)};
                `;
            }
        },
    };
}
function getTypeInfo(type) {
    let nullable = true;
    let list = false;
    let isPaginatedList = false;
    // Unwrap NonNull
    if (type instanceof GraphQLNonNull) {
        nullable = false;
        type = type.ofType;
    }
    // Unwrap List
    if (type instanceof GraphQLList) {
        list = true;
        type = type.ofType;
    }
    if (type instanceof GraphQLObjectType) {
        if (type.getInterfaces().some(i => i.name === 'PaginatedList')) {
            isPaginatedList = true;
        }
    }
    return [type.toString().replace(/!$/, ''), nullable, list, isPaginatedList];
}
function generateSchemaInfo(schema) {
    const types = schema.getTypeMap();
    const result = { types: {}, inputs: {}, scalars: [], enums: {} };
    Object.values(types).forEach(type => {
        if (isObjectType(type)) {
            const fields = type.getFields();
            result.types[type.name] = {};
            Object.entries(fields).forEach(([fieldName, field]) => {
                result.types[type.name][fieldName] = getTypeInfo(field.type);
            });
        }
        if (isInputObjectType(type)) {
            const fields = type.getFields();
            result.inputs[type.name] = {};
            Object.entries(fields).forEach(([fieldName, field]) => {
                result.inputs[type.name][fieldName] = getTypeInfo(field.type);
            });
        }
        if (isScalarType(type)) {
            result.scalars.push(type.name);
        }
        if (isEnumType(type)) {
            result.enums[type.name] = type.getValues().map(v => v.value);
        }
    });
    return result;
}
