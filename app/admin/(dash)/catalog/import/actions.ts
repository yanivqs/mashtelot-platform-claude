'use server';

import { createHash } from 'crypto';
import { parse } from 'csv-parse/sync';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { parsePlantCsvRow, upsertPlantRows, type PlantImportRow } from '@/lib/plant-import';

const MAX_ERROR_SAMPLES = 200;

export interface ImportPayload {
  rows: PlantImportRow[];
  errors: { row: number; reason: string }[];
  alreadyImportedAt: string | null;
}

export interface DryRunState {
  error?: string;
}

export async function dryRunImport(
  _prev: DryRunState,
  formData: FormData,
): Promise<DryRunState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'לא נבחר קובץ' };
  if (!file.name.toLowerCase().endsWith('.csv')) return { error: 'יש להעלות קובץ CSV' };

  const text = await file.text();
  const fileHash = createHash('sha256').update(text).digest('hex');

  const already = await prisma.importJob.findFirst({
    where: { fileHash, status: 'COMMITTED' },
    orderBy: { createdAt: 'desc' },
  });

  let records: Record<string, string>[];
  try {
    records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return { error: `קובץ CSV לא תקין: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (records.length === 0) return { error: 'הקובץ ריק' };

  const validRows: PlantImportRow[] = [];
  const errors: { row: number; reason: string }[] = [];
  records.forEach((record, i) => {
    const result = parsePlantCsvRow(record);
    if ('error' in result) errors.push({ row: i + 2, reason: result.error }); // +2: כותרת + אינדוקס מ-1
    else validRows.push(result.row);
  });

  const existing = await prisma.plant.findMany({
    where: { plantId: { in: validRows.map((r) => r.plantId) } },
    select: { plantId: true },
  });
  const existingSet = new Set(existing.map((p) => p.plantId));
  const createCount = validRows.filter((r) => !existingSet.has(r.plantId)).length;
  const updateCount = validRows.length - createCount;

  const payload: ImportPayload = {
    rows: validRows,
    errors: errors.slice(0, MAX_ERROR_SAMPLES),
    alreadyImportedAt: already?.completedAt?.toISOString() ?? null,
  };

  const job = await prisma.importJob.create({
    data: {
      createdByEmail: user.email,
      originalFilename: file.name,
      fileHash,
      status: 'DRY_RUN_COMPLETE',
      rowCount: records.length,
      createCount,
      updateCount,
      errorCount: errors.length,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
  });

  redirect(`/admin/catalog/import/${job.id}`);
}

export async function commitImport(jobId: string, _formData: FormData): Promise<void> {
  const user = await requireUser(['SUPER_ADMIN']);
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'DRY_RUN_COMPLETE') redirect('/admin/catalog/import');

  const payload = job.payload as unknown as ImportPayload;

  try {
    await upsertPlantRows(prisma, payload.rows);
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'COMMITTED', completedAt: new Date() },
    });
    await recordAudit({
      actorEmail: user.email,
      action: 'catalog_import.committed',
      entityType: 'ImportJob',
      entityId: jobId,
      metadata: {
        createCount: job.createCount,
        updateCount: job.updateCount,
        errorCount: job.errorCount,
        originalFilename: job.originalFilename,
      },
    });
  } catch (e) {
    await prisma.importJob.update({ where: { id: jobId }, data: { status: 'FAILED' } });
    throw e;
  }

  revalidatePath('/admin/catalog');
  redirect('/admin/catalog/import');
}
