/** Cliente mínimo de transacción para fusionar referencias de usuario en corp. */
export type CorporateUserMergeTx = {
    tenantMember: {
        findMany: (args: unknown) => Promise<Array<{ id: string; tenantId: string }>>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        delete: (args: unknown) => Promise<unknown>;
        deleteMany: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
    };
    leagueMember: {
        findMany: (args: unknown) => Promise<Array<{ id: string; leagueId: string }>>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        delete: (args: unknown) => Promise<unknown>;
        deleteMany: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
    };
    prediction: {
        findMany: (args: unknown) => Promise<Array<{ id: string; matchId: string; leagueId: string }>>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        delete: (args: unknown) => Promise<unknown>;
        deleteMany: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
    };
    notification: {
        updateMany: (args: unknown) => Promise<unknown>;
    };
    $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
    $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/**
 * PhaseBonus existe en la BD corp (puntuación) pero no en el cliente Prisma corporativo.
 * Sin migrar userId, user.delete() falla por FK.
 */
export async function mergeCorporatePhaseBonuses(
    tx: CorporateUserMergeTx,
    fromUserId: string,
    toUserId: string,
): Promise<void> {
    if (fromUserId === toUserId) return;

    try {
        const rows = await tx.$queryRaw<Array<{ id: string; leagueId: string; phase: string }>>`
            SELECT id, leagueId, phase FROM PhaseBonus WHERE userId = ${fromUserId}
        `;

        for (const row of rows) {
            const duplicates = await tx.$queryRaw<Array<{ id: string }>>`
                SELECT id FROM PhaseBonus
                WHERE userId = ${toUserId} AND leagueId = ${row.leagueId} AND phase = ${row.phase}
                LIMIT 1
            `;
            if (duplicates.length > 0) {
                await tx.$executeRaw`DELETE FROM PhaseBonus WHERE id = ${row.id}`;
            } else {
                await tx.$executeRaw`UPDATE PhaseBonus SET userId = ${toUserId} WHERE id = ${row.id}`;
            }
        }
    } catch {
        // Entornos sin tabla PhaseBonus: no bloquear sync.
    }
}

export async function purgeCorporatePhaseBonuses(
    tx: Pick<CorporateUserMergeTx, '$executeRaw'>,
    userId: string,
): Promise<void> {
    try {
        await tx.$executeRaw`DELETE FROM PhaseBonus WHERE userId = ${userId}`;
    } catch {
        // ignorar si no existe la tabla
    }
}

/** Cliente mínimo para purgar referencias y archivar identidad de usuario stale. */
export type CorporateUserPurgeTx = CorporateUserMergeTx & {
    user: {
        findUnique: (args: unknown) => Promise<{ documentNumber: string; username: string } | null>;
        update: (args: unknown) => Promise<unknown>;
    };
    notification?: { deleteMany: (args: unknown) => Promise<unknown> };
    verificationToken?: { deleteMany: (args: unknown) => Promise<unknown> };
    passwordResetToken?: { deleteMany: (args: unknown) => Promise<unknown> };
};

async function tryExecuteRaw(
    tx: Pick<CorporateUserMergeTx, '$executeRaw' | '$queryRaw'>,
    run: () => Promise<unknown>,
): Promise<void> {
    try {
        await run();
    } catch {
        // Tabla ausente en este entorno o sin filas: no bloquear sync.
    }
}

/**
 * Tablas heredadas del API principal (Payment, AuditLog, etc.) que pueden existir
 * en la BD corp y bloquear user.delete() aunque el schema Prisma corp no las modele.
 */
async function purgeCorporateExtensionUserReferences(
    tx: Pick<CorporateUserMergeTx, '$executeRaw' | '$queryRaw'>,
    userId: string,
): Promise<void> {
    await tryExecuteRaw(tx, async () => {
        const payments = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM Payment WHERE userId = ${userId}
        `;
        for (const payment of payments) {
            await tx.$executeRaw`DELETE FROM Transaction WHERE paymentId = ${payment.id}`;
        }
        await tx.$executeRaw`DELETE FROM Payment WHERE userId = ${userId}`;
    });

    await tryExecuteRaw(tx, () => tx.$executeRaw`DELETE FROM AuditLog WHERE userId = ${userId}`);
    await tryExecuteRaw(tx, () => tx.$executeRaw`DELETE FROM ParticipationObligation WHERE userId = ${userId}`);
    await tryExecuteRaw(tx, () => tx.$executeRaw`DELETE FROM Invitation WHERE invitedBy = ${userId}`);
    await tryExecuteRaw(tx, () => tx.$executeRaw`DELETE FROM UserAiCredits WHERE userId = ${userId}`);
    await purgeCorporatePhaseBonuses(tx, userId);
}

/**
 * Elimina dependencias del usuario antes de borrarlo.
 * Con afterMerge=true solo purga extensiones (las relaciones corp ya se fusionaron).
 */
export async function purgeCorporateUserDependencies(
    tx: CorporateUserPurgeTx,
    userId: string,
    options: { afterMerge?: boolean } = {},
): Promise<void> {
    const afterMerge = options.afterMerge ?? false;

    if (!afterMerge) {
        await tx.prediction.deleteMany({ where: { userId } });
        await tx.leagueMember.deleteMany({ where: { userId } });
        await tx.tenantMember.deleteMany({ where: { userId } });
        await tx.notification?.deleteMany?.({ where: { userId } });
        await tx.verificationToken?.deleteMany?.({ where: { userId } });
        await tx.passwordResetToken?.deleteMany?.({ where: { userId } });
    }

    await purgeCorporateExtensionUserReferences(tx, userId);
}

/**
 * Libera documentNumber/username del usuario stale para que el canónico pueda upsertear.
 * Se usa cuando user.delete() falla por FK residual.
 */
export async function releaseStaleCorporateUserIdentity(
    tx: Pick<CorporateUserPurgeTx, 'user'>,
    staleUserId: string,
): Promise<void> {
    const stale = await tx.user.findUnique({
        where: { id: staleUserId },
        select: { documentNumber: true, username: true },
    });
    if (!stale) return;

    const suffix = `_dup_${staleUserId.slice(-10)}`;
    const newDocumentNumber = `${stale.documentNumber}${suffix}`.slice(0, 64);
    const newUsername = `${stale.username}${suffix}`.slice(0, 191);

    await tx.user.update({
        where: { id: staleUserId },
        data: {
            documentNumber: newDocumentNumber,
            username: newUsername,
            status: 'INACTIVE',
        },
    });
}

export async function mergeCorporateUserReferences(
    tx: CorporateUserMergeTx,
    fromUserId: string,
    toUserId: string,
): Promise<void> {
    if (fromUserId === toUserId) return;

    const tenantMembers = await tx.tenantMember.findMany({ where: { userId: fromUserId } });
    for (const member of tenantMembers) {
        const duplicate = await tx.tenantMember.findFirst({
            where: { tenantId: member.tenantId, userId: toUserId },
        });
        if (duplicate) {
            await tx.tenantMember.delete({ where: { id: member.id } });
        } else {
            await tx.tenantMember.update({
                where: { id: member.id },
                data: { userId: toUserId },
            });
        }
    }

    const leagueMembers = await tx.leagueMember.findMany({ where: { userId: fromUserId } });
    for (const member of leagueMembers) {
        const duplicate = await tx.leagueMember.findFirst({
            where: { leagueId: member.leagueId, userId: toUserId },
        });
        if (duplicate) {
            await tx.leagueMember.delete({ where: { id: member.id } });
        } else {
            await tx.leagueMember.update({
                where: { id: member.id },
                data: { userId: toUserId },
            });
        }
    }

    const predictions = await tx.prediction.findMany({ where: { userId: fromUserId } });
    for (const prediction of predictions) {
        const duplicate = await tx.prediction.findFirst({
            where: {
                userId: toUserId,
                matchId: prediction.matchId,
                leagueId: prediction.leagueId,
            },
        });
        if (duplicate) {
            await tx.prediction.delete({ where: { id: prediction.id } });
        } else {
            await tx.prediction.update({
                where: { id: prediction.id },
                data: { userId: toUserId },
            });
        }
    }

    await tx.notification.updateMany({
        where: { userId: fromUserId },
        data: { userId: toUserId },
    });

    await mergeCorporatePhaseBonuses(tx, fromUserId, toUserId);
}
