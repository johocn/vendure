import path from 'node:path';
/**
 * Returns an array of the paths to plugins, based on the info provided by the ConfigLoaderApi.
 */
export function getDashboardPaths(pluginInfo) {
    var _a;
    return ((_a = pluginInfo === null || pluginInfo === void 0 ? void 0 : pluginInfo.flatMap(({ dashboardEntryPath, sourcePluginPath, pluginPath }) => {
        if (!dashboardEntryPath) {
            return [];
        }
        const sourcePaths = [];
        if (sourcePluginPath) {
            sourcePaths.push(path.join(path.dirname(sourcePluginPath), path.dirname(dashboardEntryPath)));
        }
        if (pluginPath) {
            sourcePaths.push(path.join(path.dirname(pluginPath), path.dirname(dashboardEntryPath)));
        }
        return sourcePaths;
    }).filter(x => x != null)) !== null && _a !== void 0 ? _a : []);
}
