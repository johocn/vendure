import { GraphQLTypesLoader } from '@nestjs/graphql';
import { getConfig, getFinalVendureSchema, resetConfig, runPluginConfigurations, setConfig, VENDURE_ADMIN_API_TYPE_PATHS, } from '@vendure/core';
import { buildSchema } from 'graphql';
let schemaPromise;
/**
 * @description
 * This function generates a GraphQL schema from the Vendure config.
 * It is used to generate the schema for the dashboard.
 */
export async function generateSchema({ vendureConfig, }) {
    if (!schemaPromise) {
        /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
        schemaPromise = new Promise(async (resolve, reject) => {
            resetConfig();
            try {
                await setConfig(vendureConfig !== null && vendureConfig !== void 0 ? vendureConfig : {});
                const runtimeConfig = await runPluginConfigurations(getConfig());
                const typesLoader = new GraphQLTypesLoader();
                const finalSchema = await getFinalVendureSchema({
                    config: runtimeConfig,
                    typePaths: VENDURE_ADMIN_API_TYPE_PATHS,
                    typesLoader,
                    apiType: 'admin',
                    output: 'sdl',
                });
                const safeSchema = buildSchema(finalSchema);
                resolve(safeSchema);
            }
            catch (e) {
                reject(e);
            }
        });
    }
    return schemaPromise;
}
