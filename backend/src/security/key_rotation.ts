import { Prisma, PrismaClient } from '@prisma/client';
import { decryptCaseSalt, encryptCaseSalt } from '../engine/provenance';

const CASE_PAGE_SIZE = 250;
const ROTATION_MAX_WAIT_MS = 10_000;
const ROTATION_TIMEOUT_MS = 300_000;

export interface CaseProvenanceKeyRotationResult {
    casesScanned: number;
    casesRotated: number;
    casesWithoutSalt: number;
}

/**
 * Re-encrypt every initialized case salt in a single database transaction.
 * The underlying salts do not change, so event keys and commitments remain valid.
 * Run with application writers quiesced during a master-key cutover.
 */
export async function rotateCaseProvenanceKeys(
    prisma: PrismaClient,
    oldMasterKey: Uint8Array,
    newMasterKey: Uint8Array,
): Promise<CaseProvenanceKeyRotationResult> {
    if (oldMasterKey.byteLength !== 32 || newMasterKey.byteLength !== 32) {
        throw new TypeError('Old and new provenance master keys must each be 32 bytes.');
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        let cursor: string | undefined;
        const result: CaseProvenanceKeyRotationResult = { casesScanned: 0, casesRotated: 0, casesWithoutSalt: 0 };

        while (true) {
            const cases = await tx.reconstructionCase.findMany({
                ...(cursor === undefined ? {} : { where: { id: { gt: cursor } } }),
                orderBy: { id: 'asc' },
                take: CASE_PAGE_SIZE,
                select: { id: true, provenanceSaltCiphertext: true },
            });
            if (cases.length === 0) break;

            for (const caseRecord of cases) {
                result.casesScanned++;
                cursor = caseRecord.id;
                if (caseRecord.provenanceSaltCiphertext === null) {
                    result.casesWithoutSalt++;
                    continue;
                }

                // Authentication failures abort the encompassing transaction;
                // no case is left rotated under a partially applied key change.
                const caseSalt = decryptCaseSalt(caseRecord.provenanceSaltCiphertext, oldMasterKey);
                const rotatedCiphertext = encryptCaseSalt(caseSalt, newMasterKey);
                const updated = await tx.reconstructionCase.updateMany({
                    where: { id: caseRecord.id, provenanceSaltCiphertext: caseRecord.provenanceSaltCiphertext },
                    data: { provenanceSaltCiphertext: rotatedCiphertext },
                });
                if (updated.count !== 1) {
                    throw new Error('Case provenance key rotation aborted because a case changed concurrently.');
                }
                result.casesRotated++;
            }
        }

        return result;
    }, { maxWait: ROTATION_MAX_WAIT_MS, timeout: ROTATION_TIMEOUT_MS });
}
