import 'server-only';
import type { PrintArtworkVersion, PrintFile } from '@prisma/client';
import { signDownloadUrl } from '@/lib/print-storage';
import type { ArtworkVersionVM } from '@/components/print/artwork-panel';
import type { PreflightResult } from '@/lib/print-preflight';

type VersionWithFiles = PrintArtworkVersion & { file: PrintFile; proofFile: PrintFile | null };

/** גרסאות גרפיקה לתצוגה, עם קישורי הורדה זמניים (5 דקות) שנוצרים בשרת. */
export async function artworkVersionsVM(versions: VersionWithFiles[]): Promise<ArtworkVersionVM[]> {
  return Promise.all(
    [...versions]
      .sort((a, b) => b.version - a.version)
      .map(async (v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        fileName: v.file.originalName,
        fileUrl: await signDownloadUrl(v.file.id),
        preflight: (v.file.preflight as PreflightResult | null) ?? null,
        proofUrl: v.proofFile ? await signDownloadUrl(v.proofFile.id) : null,
        note: v.decisionNote,
        decidedBy: v.approvedBy,
        method: v.approvalMethod,
        createdAt: v.createdAt.toISOString(),
      })),
  );
}

export const artworkInclude = {
  versions: { include: { file: true, proofFile: true } },
} as const;
