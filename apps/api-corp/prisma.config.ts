import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const corporateDatabaseUrl = process.env.CORP_DATABASE_URL?.trim();
if (corporateDatabaseUrl) {
    process.env.DATABASE_URL = corporateDatabaseUrl;
}

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: env("DATABASE_URL"),
    },
});
