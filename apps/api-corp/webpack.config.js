const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (options) => ({
    ...options,
    entry: path.resolve(__dirname, 'src/main.ts'),
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
});
