type SystemConfigRecordLike = {
  key: string;
  value: unknown;
  updatedAt: Date;
};

export function parseSystemConfigValue<T = unknown>(value: unknown): T {
  if (typeof value !== 'string') {
    return value as T;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

export function serializeSystemConfigValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null);
}

export function normalizeSystemConfigRecord<T = unknown>(record: SystemConfigRecordLike | null) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    value: parseSystemConfigValue<T>(record.value),
  };
}
