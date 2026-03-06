const DEFAULT_TIMEOUT_MS = 10000;

const CHECKS = [
  {
    label: 'root',
    method: 'GET',
    path: '/',
    expectedStatuses: [200],
    body: undefined,
  },
  {
    label: 'health-live',
    method: 'GET',
    path: '/health/live',
    expectedStatuses: [200],
    body: undefined,
  },
  {
    label: 'health-ready',
    method: 'GET',
    path: '/health/ready',
    expectedStatuses: [200],
    body: undefined,
  },
  {
    label: 'leagues',
    method: 'GET',
    path: '/leagues',
    expectedStatuses: [200, 401, 403],
    body: undefined,
  },
  {
    label: 'auth-login',
    method: 'POST',
    path: '/auth/login',
    expectedStatuses: [200, 400, 401, 422],
    body: JSON.stringify({
      identifier: 'smoke@example.com',
      password: 'invalid-password',
    }),
  },
];

async function main() {
  const { baseUrl } = parseArgs(process.argv.slice(2));

  if (!baseUrl) {
    printUsage();
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  console.log(`[smoke] Starting release smoke at ${startedAt} against ${baseUrl}`);

  let failed = false;

  for (const check of CHECKS) {
    const result = await executeCheck(baseUrl, check);
    const expectedDescription = check.expectedStatuses.join(', ');
    const statusLabel = result.ok ? 'PASS' : 'FAIL';

    console.log(
      `[smoke] ${statusLabel} ${check.method} ${check.path} -> ${result.status ?? 'ERR'} (expected: ${expectedDescription})`,
    );

    if (!result.ok) {
      failed = true;
      if (result.body) {
        console.error(`[smoke]   response: ${truncate(result.body)}`);
      }
      if (result.error) {
        console.error(`[smoke]   error: ${result.error}`);
      }
    }
  }

  if (failed) {
    console.error('[smoke] Release smoke failed. Do NOT mark the release healthy.');
    process.exit(1);
  }

  console.log('[smoke] Release smoke passed.');
}

function parseArgs(args) {
  const baseUrlArg = args.find((arg) => arg.startsWith('--baseUrl='));
  const positionalBaseUrl = args.find((arg) => !arg.startsWith('--'));
  const value = baseUrlArg ? baseUrlArg.slice('--baseUrl='.length) : positionalBaseUrl;

  return {
    baseUrl: normalizeBaseUrl(value),
  };
}

function normalizeBaseUrl(value) {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).toString().replace(/\/+$/, '');
  } catch {
    console.error(`[smoke] Invalid baseUrl: ${value}`);
    return undefined;
  }
}

async function executeCheck(baseUrl, check) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const url = new URL(check.path, `${baseUrl}/`);

  try {
    const response = await fetch(url, {
      method: check.method,
      headers: check.body
        ? {
            'Content-Type': 'application/json',
          }
        : undefined,
      body: check.body,
      signal: controller.signal,
    });

    const body = await response.text();

    return {
      ok: check.expectedStatuses.includes(response.status),
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function truncate(value) {
  return value.length > 300 ? `${value.slice(0, 297)}...` : value;
}

function printUsage() {
  console.error('Usage: npm run smoke:release -- --baseUrl=https://api.example.com');
}

main().catch((error) => {
  console.error(`[smoke] Unexpected failure: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
