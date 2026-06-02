const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (options) => {
    const rules = (options.module?.rules ?? []).map((rule) => {
        if (Array.isArray(rule.use)) {
            const newUse = rule.use.map((loader) => {
                if (typeof loader === 'string' && loader.includes('ts-loader')) {
                    return { loader, options: { transpileOnly: true } };
                }
                if (typeof loader === 'object' && loader !== null && String(loader.loader).includes('ts-loader')) {
                    return { ...loader, options: { ...(loader.options ?? {}), transpileOnly: true } };
                }
                return loader;
            });
            return { ...rule, use: newUse };
        }
        if (typeof rule.loader === 'string' && rule.loader.includes('ts-loader')) {
            return { ...rule, options: { ...(rule.options ?? {}), transpileOnly: true } };
        }
        return rule;
    });

    return {
        ...options,
        entry: path.resolve(__dirname, 'src/main.ts'),
        module: {
            ...options.module,
            rules,
        },
        resolve: {
            ...options.resolve,
            plugins: [
                new TsconfigPathsPlugin({
                    configFile: path.resolve(__dirname, 'tsconfig.build.json'),
                }),
            ],
        },
        output: {
            ...options.output,
            filename: 'main.js',
            path: path.resolve(__dirname, 'dist'),
        },
    };
};
