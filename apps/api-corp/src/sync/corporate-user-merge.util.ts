/** Cliente mínimo de transacción para fusionar referencias de usuario en corp. */
export type CorporateUserMergeTx = {
    tenantMember: {
        findMany: (args: unknown) => Promise<Array<{ id: string; tenantId: string }>>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        delete: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
    };
    leagueMember: {
        findMany: (args: unknown) => Promise<Array<{ id: string; leagueId: string }>>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        delete: (args: unknown) => Promise<unknown>;
        update: (args: unknown) => Promise<unknown>;
    };
    prediction: {
        findMany: (args: unknown) => Promise<Array<{ id: string; matchId: string; leagueId: string }>>;
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        delete: (args: unknown) => Promise<unknown>;
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
