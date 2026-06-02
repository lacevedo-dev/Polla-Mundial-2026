const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (options) => {
    const rules = (options.module?.rules ?? []).map((rule) => {
        if (rule.loader === 'ts-loader' || (rule.use && JSON.stringify(rule.use).includes('ts-loader'))) {
            return {
                ...rule,
                options: {
                    ...(rule.options ?? {}),
                    transpileOnly: true,
                },
            };
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
