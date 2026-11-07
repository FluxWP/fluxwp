import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { billingNumber, useAiBilling, type AiBillingRow } from '@fluxwp/runtime/src/modules/ai-billing';
import { Button, Spinner, Text } from '@/ui/primitives';
import { Select } from '@/ui/Select';
import { useScreenTitle } from '../kit';
import { saveReport } from './save-report';

export default function BillingScreen(_props: { params: Record<string, string> }) {
  const { t, i18n } = useTranslation(); const { theme } = useUnistyles();
  useScreenTitle(t('aiBilling.title'));
  const { query, setMonth, credits, refreshCredits, exportReport } = useAiBilling();
  const [exporting, setExporting] = useState(false); const [error, setError] = useState('');
  const locale = i18n.resolvedLanguage || i18n.language;
  const money = (value: number | string | null) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(billingNumber(value));
  const number = (value: number | string) => new Intl.NumberFormat(locale).format(billingNumber(value));
  const monthLabel = (value: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`));
  const exportCsv = async () => {
    if (exporting) return; setExporting(true); setError('');
    try { await saveReport(await exportReport(), t('aiBilling.shareUnavailable')); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setExporting(false); }
  };
  if (query.isPending) return <Spinner/>;
  if (query.isError || !query.data) return <View style={styles.card}><Text tone="danger" accessibilityRole="alert">{query.error instanceof Error ? query.error.message : t('states.errorTitle')}</Text><Button label={t('common.retry')} onPress={() => void query.refetch()}/></View>;
  const data = query.data; const report = data.month; const maximum = Math.max(...report.daily.map(day => day.cost), 0.0001);
  const breakdown = (title: string, rows: AiBillingRow[], provider = false) => <View style={styles.card}><Text variant="heading">{title}</Text>{rows.length ? rows.map(row => <View key={row.k} style={styles.breakdown}><Text variant="label">{row.label}</Text>{provider && billingNumber(row.est) > 0 && <Text variant="caption" tone="muted">{t('aiBilling.estimated')}</Text>}<Text>{money(row.cost)}</Text><Text variant="small" tone="muted">{t('aiBilling.calls')}: {number(row.calls)} · {t('aiBilling.input')}: {number(row.in_tok)} · {t('aiBilling.output')}: {number(row.out_tok)}</Text><Text variant="small" tone="muted">{t('aiBilling.withoutCache', { amount: money(row.full_cost) })}</Text></View>) : <Text tone="muted">{t('aiBilling.empty')}</Text>}</View>;
  return <ScrollView testID="screen-ai-billing" style={styles.screen} contentContainerStyle={styles.content}>
    <Text variant="title">{t('aiBilling.title')}</Text><Text tone="muted">{t('aiBilling.intro')}</Text>
    <Select label={t('aiBilling.months')} value={report.ym} options={data.months.map(month => ({ value: month.ym, label: `${monthLabel(month.ym)} · ${money(month.cost)}` }))} onChange={setMonth}/>
    <Button kind="secondary" label={t('aiBilling.refresh')} loading={query.isFetching} disabled={query.isFetching} onPress={() => void query.refetch()}/>
    {(['day', 'week', 'month'] as const).map(period => { const budget = data.budget[period]; return <View key={period} style={[styles.card, budget.over && { borderColor: theme.colors.danger }]}><Text variant="label">{t(`aiBilling.${period}`)}</Text><Text variant="heading">{money(budget.spent)} / {budget.limit > 0 ? money(budget.limit) : t('aiBilling.unlimited')}</Text>{budget.limit > 0 && <View style={styles.track} accessible accessibilityRole="progressbar" accessibilityLabel={t(`aiBilling.${period}`)} accessibilityValue={{ min: 0, max: 100, now: Math.min(100, budget.pct) }}><View style={[styles.progress, { width: `${Math.min(100, budget.pct)}%` }]}/></View>}<Text variant="caption" tone="muted">{t('aiBilling.resets', { time: new Date(budget.resets * 1000).toLocaleString(locale) })}</Text></View>; })}
    <View style={styles.card}><Text variant="heading">{monthLabel(report.ym)}</Text><Text variant="label">{t('aiBilling.cost')}</Text><Text variant="title">{money(report.totals.cost)}</Text><Text tone="muted">{t('aiBilling.withoutCache', { amount: money(report.totals.full_cost) })}</Text><Text>{t('aiBilling.saved')}: {money(report.totals.saved)}{report.totals.full_cost > 0 ? ` (${number(Math.round(report.totals.saved / report.totals.full_cost * 1000) / 10)}%)` : ''}</Text><Text>{t('aiBilling.calls')}: {number(report.totals.calls)}</Text>
      <Text variant="label">{t('aiBilling.daily')}</Text><ScrollView horizontal><View style={styles.chart}>{report.daily.map(day => <View key={day.date} accessible accessibilityLabel={`${day.date}: ${money(day.cost)}, ${number(day.calls)} ${t('aiBilling.calls')}`} style={styles.day}><View style={[styles.bar, { height: Math.max(1, day.cost / maximum * 120) }]}/><Text variant="caption">{day.date.slice(-2)}</Text></View>)}</View></ScrollView>
      {!data.export_available && <Text tone="muted">{t('aiBilling.exportUpdate')}</Text>}{!!error && <Text tone="danger" accessibilityRole="alert">{error}</Text>}<Button label={t('aiBilling.export')} loading={exporting} disabled={exporting || !data.export_available} onPress={() => void exportCsv()}/>
    </View>
    {breakdown(t('aiBilling.providers'), report.by_provider, true)}{breakdown(t('aiBilling.sources'), report.by_source)}{breakdown(t('aiBilling.models'), report.by_model)}
    <View style={styles.card}><Text variant="heading">{t('aiBilling.creditsTitle')}</Text>{credits.error && <Text tone="danger" accessibilityRole="alert">{credits.error.message}</Text>}{data.credits ? <>{(['credits', 'usage', 'limit', 'remaining'] as const).map(key => data.credits![key] !== null && <View key={key} style={styles.credit}><Text style={styles.flex}>{t(`aiBilling.${key}`)}</Text><Text variant="label">{money(data.credits![key])}</Text></View>)}<Text variant="caption">{t('aiBilling.checked')}: {new Date(data.credits.checked * 1000).toLocaleString(locale)}</Text></> : <Text tone="muted">{t('aiBilling.creditsHint')}</Text>}<Button kind="secondary" label={t('aiBilling.refresh')} loading={credits.isPending} disabled={credits.isPending} onPress={refreshCredits}/></View>
  </ScrollView>;
}
const styles = StyleSheet.create(theme => ({
  screen: { flex: 1, backgroundColor: theme.colors.bg }, content: { padding: 16, paddingBottom: 40, gap: 16 }, flex: { flex: 1 },
  card: { padding: 16, gap: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  breakdown: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: 12 }, credit: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  track: { height: 6, backgroundColor: theme.colors.surface2, borderRadius: 3, overflow: 'hidden' }, progress: { height: 6, backgroundColor: theme.colors.primary },
  chart: { flexDirection: 'row', gap: 5, alignItems: 'flex-end', height: 150 }, day: { width: 18, alignItems: 'center', justifyContent: 'flex-end', gap: 5 }, bar: { width: 14, backgroundColor: theme.colors.primary, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
}));
