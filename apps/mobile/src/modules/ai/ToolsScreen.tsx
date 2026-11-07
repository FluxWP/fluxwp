import { FlatList, Pressable, ScrollView, Switch, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native-unistyles';
import { ApiError } from '@fluxwp/core';
import { useAccount } from '@fluxwp/runtime';
import { useAiTools, type AiToolFilter, type AiToolRow } from '@fluxwp/runtime/src/modules/ai-tools';
import { Button, Field, Text } from '@/ui/primitives';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { useScreenTitle } from '../kit';

export default function ToolsScreen({params}: { params: Record<string, string> }) { const account = useAccount(); return <ToolsView key={`${account.id}|${params.source??''}`} source={params.source??''}/>; }
function ToolsView({source}:{source:string}) {
  const { t } = useTranslation(); const c = useAiTools(source); const data = c.query.data; const { height } = useWindowDimensions();
  useScreenTitle(t('aiTools.title'));
  const unavailable = c.busy || c.query.isPlaceholderData;
  const enabled = (row: AiToolRow) => c.draft[row.name] ?? !row.off;
  const visible = data?.items.filter(row => !row.dupe) ?? [];
  const selectedPage = visible.length > 0 && visible.every(row => c.isSelected(row.name));
  const status = (row: AiToolRow) => row.dupe ? t('aiTools.duplicate') : enabled(row) ? t('aiTools.on') : t('aiTools.off');
  const selection = (label: string, checked: boolean, onChange: (checked: boolean) => void, disabled = unavailable) => <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={styles.selection}><View style={[styles.checkbox, checked && styles.checked]}>{checked && <Text style={styles.checkmark}>✓</Text>}</View><Text variant="small" style={styles.flex}>{label}</Text></Pressable>;
  const failure = c.query.error instanceof ApiError && c.query.error.status === 404 ? t('aiTools.updateRequired') : c.query.error instanceof Error ? c.query.error.message : t('states.errorTitle');
  const header = <View style={styles.header}>
    <Text variant="title">{t('aiTools.title')}</Text><Text tone="muted">{t('aiTools.intro')}</Text>
    <Button kind="secondary" label={t('aiTools.reload')} disabled={c.busy} onPress={() => void c.reload()}/>
    {data && <View style={styles.summary}>{(['tools','on','off','conflicts','unprefixed'] as const).map(key => <View key={key} style={styles.stat}><Text variant="caption" tone="muted">{t(`aiTools.${key}`)}</Text><Text variant="heading">{data.summary[key]}</Text></View>)}</View>}
    <Field label={t('aiTools.search')} value={c.search} onChangeText={c.setSearch} placeholder={t('aiTools.searchPlaceholder')} autoCorrect={false} editable={!c.busy}/>
    <Select label={t('aiTools.source')} value={c.filter.source} disabled={c.busy} onChange={source => c.setFilter({ source })} options={[{value:'',label:t('aiTools.allSources')},...(data?.sources.filter(source => source.id).map(source => ({value:source.id,label:`${source.label} (${source.on}/${source.total})`}))??[])]}/>
    <View style={styles.filters}><View style={styles.flex}><Select label={t('aiTools.kind')} value={c.filter.kind} disabled={c.busy} onChange={kind => c.setFilter({kind:kind as AiToolFilter['kind']})} options={(['','read','write'] as const).map(value => ({value,label:t(value?`aiTools.${value}`:'aiTools.all')}))}/></View><View style={styles.flex}><Select label={t('aiTools.state')} value={c.filter.state} disabled={c.busy} onChange={state => c.setFilter({state:state as AiToolFilter['state']})} options={(['','on','off','conflict','noprefix'] as const).map(value => ({value,label:t(value?`aiTools.${value}`:'aiTools.all')}))}/></View></View>
    {!!c.error && <Text tone="danger" accessibilityRole="alert">{c.error}</Text>}{c.stale && <Text tone="danger" accessibilityRole="alert">{t('aiTools.stale')}</Text>}{c.query.isError && <Text tone="danger" accessibilityRole="alert">{failure}</Text>}
    <Text variant="small" tone="muted" accessibilityLiveRegion="polite">{c.query.isFetching?t('states.loading'):t('aiTools.results',{count:data?.total??0})}</Text>
    {selection(t('aiTools.selectPage'),selectedPage,c.selectPage,unavailable||!visible.length)}
    <Button kind="ghost" label={t('aiTools.selectMatching',{count:data?.selectable_total??0})} disabled={unavailable||!data?.selectable_total||c.search!==c.filter.q} onPress={c.setMatching}/>
    {c.selectionCount>0 && <View style={styles.bulk}><Text variant="label">{t('aiTools.selected',{count:c.selectionCount})}</Text><View style={styles.filters}><Button kind="secondary" label={t('aiTools.enable')} disabled={unavailable||c.stale} onPress={() => void c.save('enable')}/><Button kind="secondary" label={t('aiTools.disable')} disabled={unavailable||c.stale} onPress={() => void c.save('disable')}/></View><Button kind="ghost" label={t('aiTools.clear')} disabled={c.busy} onPress={c.clearSelection}/></View>}
  </View>;
  return <View style={styles.screen} testID="screen-ai-tools">
    <FlatList data={data?.items??[]} keyExtractor={row=>row.id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" ListHeaderComponent={header} ListEmptyComponent={<Text tone="muted">{c.query.isPending?t('states.loading'):t('aiTools.empty')}</Text>}
      renderItem={({item:row}) => <View style={[styles.card,row.dupe&&styles.dupe]}>
        {!row.dupe && selection(t('aiTools.selectTool',{name:row.title}),c.isSelected(row.name),checked=>c.select(row.name,checked))}
        <Pressable accessibilityRole="button" accessibilityLabel={row.title} disabled={unavailable} onPress={()=>c.setDetail(row)}><Text variant="heading">{row.title}</Text><Text variant="caption" tone="muted">{row.name}</Text></Pressable>
        <Text variant="small" numberOfLines={2}>{row.description}</Text><Text variant="small" tone="muted">{row.label} · {t(row.readonly?'aiTools.read':'aiTools.write')} · {status(row)}</Text>
        {row.approval && <Text variant="caption">{t('aiTools.approval')}</Text>}
        <View style={styles.enabledRow}><Text style={styles.flex}>{t('aiTools.enabled')}</Text>{row.dupe?<Button kind="secondary" label={t('aiTools.useDefinition')} disabled={unavailable||!!c.dirty} onPress={()=>void c.save('pick',row)}/>:<Switch accessibilityLabel={t('aiTools.enabledTool',{name:row.title})} value={enabled(row)} disabled={unavailable} onValueChange={value=>c.toggle(row,value)}/>}</View>
        <Text variant="caption" tone="muted">{t('aiTools.where')}: {[row.mcp?'MCP':'',row.chat?t('aiTools.chat'):''].filter(Boolean).join(' · ')||'—'} · {t('aiTools.cap')}: {row.cap||'—'}</Text>
        <Text variant="caption" tone="muted">{t('aiTools.usage')}: {row.usage?`${row.usage.n} · ${Math.round(row.usage.avg_ms)} ms`:'—'}</Text>
      </View>}
      ListFooterComponent={<View style={styles.footer}><View style={styles.pagination}><Button kind="ghost" label={t('aiTools.previous')} disabled={unavailable||c.page<=1} onPress={()=>c.setPage(c.page-1)}/><Text variant="small">{t('aiTools.page',{page:c.page,pages:data?.pages??1})}</Text><Button kind="ghost" label={t('aiTools.next')} disabled={unavailable||!data||c.page>=data.pages} onPress={()=>c.setPage(c.page+1)}/></View><Button label={t('aiTools.save')} disabled={unavailable||!c.dirty||c.stale} loading={c.busy} onPress={()=>void c.save('save')}/>{!!c.dirty&&<Text variant="caption" tone="muted">{t('aiTools.dirty',{count:c.dirty})}</Text>}<Text variant="caption" tone="muted">{t('aiTools.registrationHint')}</Text></View>}/>
    <Sheet visible={!!c.detail} onDismiss={()=>c.setDetail(null)}><ScrollView style={{height:Math.min(height*.6,500)}} contentContainerStyle={styles.detail}>{c.detail&&<><Text variant="heading">{c.detail.title}</Text><Text variant="caption" tone="muted">{c.detail.name}</Text><Text>{c.detail.description}</Text><Text>{t('aiTools.source')}: {c.detail.label} · {c.detail.source}</Text><Text>{t('aiTools.state')}: {status(c.detail)}</Text><Text>{t('aiTools.cap')}: {c.detail.cap||'—'}</Text><Text>{t('aiTools.aliases')}: {c.detail.aliases.join(', ')||'—'}</Text><Text>{t('aiTools.rivals')}: {c.detail.rivals.join(', ')||'—'}</Text>{c.detail.approval&&<Text>{t('aiTools.approval')}</Text>}</>}</ScrollView></Sheet>
  </View>;
}
const styles = StyleSheet.create(theme=>({
  screen:{flex:1,backgroundColor:theme.colors.bg},content:{padding:16,paddingBottom:32,gap:12},header:{gap:14,marginBottom:10},flex:{flex:1,minWidth:0},filters:{flexDirection:'row',gap:10,flexWrap:'wrap'},summary:{flexDirection:'row',flexWrap:'wrap',gap:8},stat:{minWidth:96,flexGrow:1,padding:12,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,backgroundColor:theme.colors.surface},card:{padding:14,gap:10,backgroundColor:theme.colors.surface,borderRadius:theme.radius.lg,borderWidth:1,borderColor:theme.colors.border},dupe:{backgroundColor:theme.colors.surface2},selection:{flexDirection:'row',alignItems:'center',gap:10,minHeight:44},checkbox:{width:22,height:22,borderRadius:6,borderWidth:1,borderColor:theme.colors.border,alignItems:'center',justifyContent:'center'},checked:{backgroundColor:theme.colors.primary,borderColor:theme.colors.primary},checkmark:{color:theme.colors.onPrimary},enabledRow:{flexDirection:'row',alignItems:'center',gap:10},bulk:{padding:12,gap:10,backgroundColor:theme.colors.primarySoft,borderRadius:theme.radius.md},footer:{gap:14,paddingTop:16},pagination:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},detail:{gap:12,paddingBottom:20},
}));
