import { useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useAccount } from '@fluxwp/runtime';
import { useAiMcp } from '@fluxwp/runtime/src/modules/ai-mcp';
import { Button, Field, Text } from '@/ui/primitives';
import { Select } from '@/ui/Select';
import { Sheet } from '@/ui/Sheet';
import { useScreenTitle } from '../kit';

export default function McpScreen(){const account=useAccount();return <McpView key={account.id}/>;}
function McpView(){
 const {t,i18n}=useTranslation();const c=useAiMcp();const s=c.state;const [picker,setPicker]=useState(false);useScreenTitle(t('aiMcp.title'));
 const locked=c.busy||!!s?.legacy;const date=(at:number)=>at?new Date(at*1000).toLocaleString(i18n.language):t('aiMcp.never');
 const copy=(label:string,value:string)=><Button kind="secondary" label={label} onPress={()=>void c.copy(value)}/>;
 return <View style={styles.screen} testID="screen-ai-mcp"><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
  <Text variant="title">{t('aiMcp.title')}</Text><Text tone="muted">{t('aiMcp.intro')}</Text><Button kind="ghost" disabled={c.busy} label={t('aiTools.reload')} onPress={()=>void c.reload()}/>
  {c.query.isPending&&<Text>{t('states.loading')}</Text>}{c.query.isError&&<Text tone="danger" accessibilityRole="alert">{c.query.error.message}</Text>}{!!c.error&&<Text tone="danger" accessibilityRole="alert">{c.error}</Text>}
  {s&&<>
   {s.legacy&&<Text tone="danger">{t('aiMcp.legacy')}</Text>}
   <View style={styles.card}><Text variant="heading">{t('aiMcp.server')}</Text><Text>{t(s.enabled?'aiMcp.on':'aiMcp.off')}</Text><Text selectable variant="small">{s.url}</Text>{copy(t('aiMcp.copyUrl'),s.url)}<Button kind="secondary" label={t(s.enabled?'aiMcp.turnOff':'aiMcp.turnOn')} disabled={locked} onPress={()=>void c.toggle()}/><Text tone="muted" variant="small">{t('aiMcp.approvalHelp')}</Text></View>
   {c.created&&<View style={styles.card} accessibilityLabel={t('aiMcp.newKey')}><Text variant="heading">{t('aiMcp.newKey')}</Text><Text>{t('aiMcp.once')}</Text><Text selectable style={styles.code}>{c.created.secret}</Text>{copy(t('aiMcp.copyKey'),c.created.secret)}{copy(t('aiMcp.copyConfig'),c.config())}{copy(t('aiMcp.copyKeyUrl'),c.keyUrl())}<Text tone="muted" variant="small">{t('aiMcp.urlWarning')}</Text><Button kind="ghost" label={t('aiMcp.dismiss')} onPress={c.dismiss}/></View>}
   <View style={styles.card}><Text variant="heading">{t('aiMcp.create')}</Text><Text tone="muted" variant="small">{t('aiMcp.ownerHelp')}</Text>
    <Field label={t('aiMcp.name')} value={c.form.name} editable={!locked&&!c.created} onChangeText={name=>c.edit({name})}/>
    <Select label={t('aiMcp.scope')} value={c.form.scope} onChange={scope=>c.edit({scope:scope as 'selected'|'all'})} disabled={locked||!!c.created} options={[{value:'selected',label:t('aiMcp.selected')},{value:'all',label:t('aiMcp.all')}]}/>
    {c.form.scope==='all'?<Text tone="danger">{t('aiMcp.allHelp')}</Text>:<><Text>{t('aiMcp.selectedCount',{count:c.form.tools.length})}</Text><Button kind="secondary" label={t('aiMcp.chooseTools')} disabled={locked||!!c.created} onPress={()=>setPicker(true)}/></>}
    {c.stale&&<Text tone="danger" accessibilityRole="alert">{t('aiMcp.stale')}</Text>}
    <Button label={t('aiMcp.create')} disabled={locked||c.stale||!!c.created||c.form.scope==='selected'&&!c.form.tools.length} onPress={()=>void c.create()}/><Button kind="ghost" label={t('aiMcp.reset')} disabled={c.busy||!!c.created} onPress={c.reset}/>
   </View>
   <View style={styles.card}><Text variant="heading">{t('aiMcp.keys')}</Text>{s.keys.map(key=><View style={styles.key} key={key.id}><Text variant="heading">{key.name}</Text><Text variant="small">{t('aiMcp.owner')}: {key.owner||'—'} · …{key.hint}</Text><Text>{key.tools?t('aiMcp.selectedCount',{count:key.tools.length}):t('aiMcp.all')}</Text>{key.tools&&<Text selectable variant="caption" tone="muted">{key.tools.join(', ')}</Text>}<Text variant="caption" tone="muted">{t('aiMcp.created')}: {date(key.created)}{ '\n'}{t('aiMcp.lastUsed')}: {date(key.last_used)}</Text><Button kind="secondary" label={t('aiMcp.revoke')} disabled={locked} onPress={()=>void c.revoke(key)}/></View>)}{!s.keys.length&&<Text tone="muted">{t('aiMcp.noKeys')}</Text>}</View>
   <View style={styles.card}><Text variant="heading">{t('aiMcp.connect')}</Text><Text>{t('aiMcp.connectHelp')}</Text><Text selectable style={styles.code}>{c.config()}</Text>{!c.created&&copy(t('aiMcp.copyTemplate'),c.config())}<Text variant="heading">{t('aiMcp.cli')}</Text><Text selectable style={styles.code}>{c.cli()}</Text>{copy(t('aiMcp.copyCli'),c.cli())}<Text variant="heading">{t('aiMcp.keyUrl')}</Text><Text selectable style={styles.code}>{c.keyUrl()}</Text>{copy(t('aiMcp.copyKeyUrl'),c.keyUrl())}<Text variant="small" tone="muted">{t('aiMcp.urlWarning')}</Text><Text variant="small" tone="muted">{t('aiMcp.headerHelp')}</Text></View>
   <View style={styles.card}><Text variant="heading">{t('aiMcp.log')}</Text>{s.log.map((entry,i)=><View style={styles.key} key={`${entry.at}-${i}`}><Text>{entry.tool}</Text><Text variant="small">{entry.target}</Text><Text variant="caption" tone="muted">{entry.owner} · {date(entry.at)} · {t(entry.ok?'aiMcp.success':'aiMcp.failed')}</Text></View>)}{!s.log.length&&<Text tone="muted">{t('aiMcp.noLog')}</Text>}</View>
  </>}
 </ScrollView><Sheet visible={picker} onDismiss={()=>setPicker(false)}><View style={styles.picker}><Text variant="heading">{t('aiMcp.chooseTools')}</Text><Field label={t('aiMcp.search')} value={c.search} onChangeText={c.setSearch}/><Text variant="small">{t('aiMcp.selectedCount',{count:c.form.tools.length})}</Text>
  <FlatList style={styles.toolList} data={c.filteredTools} keyExtractor={tool=>tool.name} keyboardShouldPersistTaps="handled" renderItem={({item:tool})=><View style={styles.tool}><Text variant="heading">{tool.title}</Text><Text variant="caption" tone="muted">{tool.name} · {tool.label}</Text><Text variant="small">{t(tool.readonly?'aiMcp.read':'aiMcp.write')}{tool.off?` · ${t('aiMcp.disabled')}`:''}{!tool.allowed?` · ${t('aiMcp.noPermission')}`:''}</Text><Text variant="small" tone="muted">{tool.description}</Text><Button kind={c.form.tools.includes(tool.name)?'primary':'secondary'} label={t(c.form.tools.includes(tool.name)?'aiMcp.unselect':'aiMcp.select')} disabled={locked} onPress={()=>c.select(tool.name)}/></View>} ListEmptyComponent={<Text tone="muted">{t('aiMcp.noTools')}</Text>}/>
  <Button label={t('common.close')} onPress={()=>setPicker(false)}/></View></Sheet></View>;
}
const styles=StyleSheet.create(theme=>({screen:{flex:1,backgroundColor:theme.colors.bg},content:{padding:16,paddingBottom:32,gap:16},card:{padding:16,gap:14,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.lg,backgroundColor:theme.colors.surface},key:{paddingVertical:12,gap:10,borderBottomWidth:1,borderColor:theme.colors.border},code:{fontFamily:'monospace',fontSize:12,backgroundColor:theme.colors.surface2,padding:12,borderRadius:8},picker:{gap:12},toolList:{height:300,flexGrow:0},tool:{padding:12,gap:8,borderBottomWidth:1,borderColor:theme.colors.border}}));
