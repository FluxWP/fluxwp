import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { AiBillingExport } from '@fluxwp/runtime/src/modules/ai-billing';

export async function saveReport(report: AiBillingExport, unavailable: string): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error(unavailable);
  const directory = new Directory(Paths.cache, `fluxwp-export-${Date.now()}-${Math.random().toString(36).slice(2)}`); await directory.create();
  try {
    const file = new File(directory, report.filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
    await file.create(); await file.write(report.csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
  } finally {
    if (directory.exists) await directory.delete();
  }
}
