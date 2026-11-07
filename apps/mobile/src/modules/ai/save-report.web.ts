import type { AiBillingExport } from '@fluxwp/runtime/src/modules/ai-billing';

export async function saveReport(report: AiBillingExport, _unavailable: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([report.csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = report.filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
