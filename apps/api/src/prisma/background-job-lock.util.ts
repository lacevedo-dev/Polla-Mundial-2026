const activeJobKeys = new Set<string>();

export async function tryRunExclusiveBackgroundJob<T>(
  key: string,
  job: () => Promise<T>,
): Promise<{ ran: true; result: T } | { ran: false }> {
  if (activeJobKeys.has(key)) {
    return { ran: false };
  }

  activeJobKeys.add(key);

  try {
    return {
      ran: true,
      result: await job(),
    };
  } finally {
    activeJobKeys.delete(key);
  }
}
