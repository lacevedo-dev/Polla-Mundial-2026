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
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-queue\.service/,
            path.resolve(__dirname, 'src/email/email-queue.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email\.service/,
            path.resolve(__dirname, 'src/email/email.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-blacklist\.service/,
            path.resolve(__dirname, 'src/email/email-blacklist.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-provider-accounts\.service/,
            path.resolve(__dirname, 'src/email/email-provider-accounts.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-provider-config\.service/,
            path.resolve(__dirname, 'src/email/email-provider-config.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-provider-crypto\.service/,
            path.resolve(__dirname, 'src/email/email-provider-crypto.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-backlog-audit\.service/,
            path.resolve(__dirname, 'src/email/email-backlog-audit.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-backlog-audit\.shared/,
            path.resolve(__dirname, 'src/email/email-backlog-audit.shared.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-backlog-audit\.scheduler/,
            path.resolve(__dirname, 'src/email/email-backlog-audit.scheduler.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email-testing\.service/,
            path.resolve(__dirname, 'src/email/email-testing.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]match-email-template\.service/,
            path.resolve(__dirname, 'src/email/match-email-template.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]email[\\/]email\.module/,
            path.resolve(__dirname, 'src/email/email.module.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]corporate-tenant[\\/]tenant-provisioning\.service/,
            (result) => {
                if (result.contextInfo.issuer && result.contextInfo.issuer.includes('overrides')) {
                    return;
                }
                const overridePath = path.resolve(__dirname, 'src/overrides/tenant-provisioning.service.ts');
                result.createData.resource = overridePath;
                result.createData.context = path.dirname(overridePath);
            },
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]corporate-tenant[\\/]corporate-tenant\.module/,
            (result) => {
                const overridePath = path.resolve(__dirname, 'src/overrides/corporate-tenant.module.ts');
                result.createData.resource = overridePath;
                result.createData.context = path.dirname(overridePath);
            },
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]corporate-tenant[\\/]corp-members-resend\.controller/,
            path.resolve(__dirname, 'src/overrides/corp-members-resend.controller.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]corporate-tenant[\\/]dto[\\/]update-member\.dto/,
            path.resolve(__dirname, 'src/overrides/corporate-tenant/dto/update-member.dto.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]corporate-tenant[\\/]branding-storage\.service/,
            path.resolve(__dirname, 'src/overrides/branding-storage.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]prisma[\\/]prisma\.service/,
            path.resolve(__dirname, 'src/overrides/prisma.service.ts'),
        ),
        new webpack.NormalModuleReplacementPlugin(
            /apps[\\/]api[\\/]src[\\/]prisma[\\/]prisma\.module/,
            path.resolve(__dirname, 'src/overrides/prisma.module.ts'),
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
