import {useState} from 'react';
import {FlatList,Pressable,View,useWindowDimensions} from 'react-native';
import {useTranslation} from 'react-i18next';
import {StyleSheet,useUnistyles} from 'react-native-unistyles';
import {Sheet} from './Sheet';
import {Field,Text} from './primitives';
import {Icon} from './Icon';
export interface SelectOption {value:string;label:string;disabled?:boolean}
const fold=(s:string)=>s.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/ı/g,'i');
/** Native searchable sheet; long option lists are virtualized on iOS and Android. */
export function Select({label,value,options,onChange,disabled}:{label:string;value:string;options:SelectOption[];onChange:(value:string)=>void;disabled?:boolean}) {
 const {t}=useTranslation();const {theme}=useUnistyles();const {height}=useWindowDimensions();const [open,setOpen]=useState(false);const [search,setSearch]=useState('');
 const close=()=>{setOpen(false);setSearch('');};const selected=options.find(o=>o.value===value)?.label||t('selectControl.choose');
 const rows=options.filter(o=>!search||fold(o.label).includes(fold(search)));
 return <View style={styles.field}><Text variant="label">{label}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{text:selected}} accessibilityState={{disabled:!!disabled,expanded:open&&!disabled}} disabled={disabled} onPress={()=>setOpen(true)} style={styles.trigger}><Text style={styles.fill}>{selected}</Text><Icon name="chevron-down" size={18} color={theme.colors.textMuted}/></Pressable>
  <Sheet visible={open&&!disabled} onDismiss={close}><Text variant="heading">{label}</Text>{options.length>8&&<Field label={t('selectControl.search')} placeholder={t('selectControl.searchPlaceholder')} value={search} onChangeText={setSearch} autoCorrect={false}/>}
   <FlatList style={{height:Math.min(Math.max(96,rows.length*48),height*.45)}} data={rows} keyExtractor={o=>o.value} keyboardShouldPersistTaps="handled" getItemLayout={(_d,i)=>({length:48,offset:48*i,index:i})} ListEmptyComponent={<Text tone="muted">{t('selectControl.empty')}</Text>} renderItem={({item:o})=><Pressable accessibilityRole="button" aria-pressed={o.value===value} accessibilityState={{selected:o.value===value,disabled:!!o.disabled}} disabled={o.disabled} onPress={()=>{onChange(o.value);close();}} style={[styles.option,o.value===value&&styles.active,o.disabled&&styles.disabled]}><Text style={styles.fill} numberOfLines={1}>{o.label}</Text>{o.value===value&&<Icon name="check" size={18} color={theme.colors.primary}/>}</Pressable>}/>
  </Sheet>
 </View>;
}
const styles=StyleSheet.create(theme=>({field:{gap:6},fill:{flex:1},trigger:{minHeight:46,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,borderWidth:1,borderColor:theme.colors.border,borderRadius:theme.radius.md,backgroundColor:theme.colors.surface},option:{height:48,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,borderRadius:theme.radius.md},active:{backgroundColor:theme.colors.primarySoft},disabled:{opacity:.4}}));
