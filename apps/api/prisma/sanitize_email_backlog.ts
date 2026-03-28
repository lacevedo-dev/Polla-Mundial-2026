import 'dotenv/config';

import { PrismaService } from '../src/prisma/prisma.service';
import { runEmailBacklogAudit } from '../src/email/email-backlog-audit.shared';

const APPLY = process.argv.includes('--apply');

async function main() {
  const prisma = new PrismaService();
  try {
    const result = await runEmailBacklogAudit(prisma, {
      apply: APPLY,
      trigger: 'CLI',
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error(
    `[sanitize-email-backlog] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
