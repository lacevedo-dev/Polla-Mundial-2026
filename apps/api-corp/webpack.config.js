const path = require('path');
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (options) => {
    const rules = (options.module?.rules ?? []).map((rule) => {
        if (Array.isArray(rule.use)) {
            return {
                ...rule,
                use: rule.use.map((loader) => {
                    if (
                        typeof loader === 'object' &&
                        loader !== null &&
                        typeof loader.loader === 'string' &&
                        loader.loader.includes('ts-loader')
                    ) {
                        return { ...loader, options: { ...(loader.options ?? {}), transpileOnly: true } };
                    }
                    return loader;
                }),
            };
        }
        if (typeof rule.loader === 'string' && rule.loader.includes('ts-loader')) {
            return { ...rule, options: { ...(rule.options ?? {}), transpileOnly: true } };
        }
        return rule;
    });

    const plugins = [
        ...(options.plugins ?? []).filter(
            (p) => p && p.constructor && p.constructor.name !== 'ForkTsCheckerWebpackPlugin',
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]auth[\\/]avatar-storage\.service/,
            path.resolve(__dirname, 'src/overrides/avatar-storage.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-dispatcher\.scheduler/,
            path.resolve(__dirname, 'src/overrides/email-dispatcher.scheduler.ts'),
        ),
    ];

    return {
        ...options,
        entry: path.resolve(__dirname, 'src/main.ts'),
        externals: [
            { 'bcrypt': 'commonjs bcrypt' },
            function ({ request }, callback) {
                if (request && request.startsWith('node:')) {
                    return callback(null, `commonjs ${request}`);
                }
                return callback();
            },
            ...(Array.isArray(options.externals) ? options.externals : options.externals ? [options.externals] : []),
        ],
        module: { ...options.module, rules },
        plugins,
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
