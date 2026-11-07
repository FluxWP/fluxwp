import {useState} from 'react';
import {Platform,View} from 'react-native';
import {DateTimePicker} from '@expo/ui/community/datetime-picker';
import {useTranslation} from 'react-i18next';
import {useUnistyles} from 'react-native-unistyles';
import {Sheet} from '@/ui/Sheet';
import {Button,Field,Text} from '@/ui/primitives';
const pad=(n:number)=>String(n).padStart(2,'0');
/** Select wall-clock date and time independently, then let the shared model resolve the SITE timezone. */
export function ScheduleField({label,value,fallback,onChange,disabled,help}:{label:string;value:string;fallback:string;onChange:(value:string)=>void;disabled:boolean;help:string}){
 const {t}=useTranslation();const {theme}=useUnistyles();const [mode,setMode]=useState<'date'|'time'|null>(null);
 const [day,clock]=(value||fallback).replace('T',' ').split(' ');const [year,month,date]=(day||'').split('-').map(Number);const [hour,minute]=(clock||'10:00').split(':').map(Number);
 // Noon for calendar selection and a fixed non-transition day for the time wheel avoid device DST changing site wall time.
 const initial=mode==='time'?new Date(2000,0,15,hour,minute):new Date(year!,month!-1,date!,12);
 const change=(_event:unknown,picked:Date)=>{const next=mode==='time'?`${day} ${pad(picked.getHours())}:${pad(picked.getMinutes())}`:`${picked.getFullYear()}-${pad(picked.getMonth()+1)}-${pad(picked.getDate())} ${clock||'10:00'}`;onChange(next);if(Platform.OS==='android')setMode(null);};
 if(Platform.OS==='web')return <Field label={label} help={help} placeholder={fallback} value={value} editable={!disabled} onChangeText={onChange} autoCorrect={false}/>;
 const picker=mode&&<DateTimePicker key={mode} mode={mode} value={initial} display={Platform.OS==='ios'?'spinner':'default'} is24Hour onValueChange={change} onDismiss={()=>setMode(null)} accentColor={theme.colors.primary} themeVariant={theme.mode} positiveButton={{label:t('common.done')}} negativeButton={{label:t('common.cancel')}}/>;
 return <View style={{gap:8}}><Text variant="label">{label}</Text><View style={{flexDirection:'row',gap:8}}><Button kind="secondary" label={value?day!:t('socialComposer.chooseDate')} disabled={disabled} onPress={()=>setMode('date')}/><Button kind="secondary" label={value?clock!:t('socialComposer.chooseTime')} disabled={disabled} onPress={()=>setMode('time')}/></View>{Platform.OS==='android'?picker:<Sheet visible={!!mode} onDismiss={()=>setMode(null)}><Text variant="heading">{label}</Text>{picker}<Button label={t('common.done')} onPress={()=>{if(!value)onChange(fallback);setMode(null);}}/></Sheet>}</View>;
}
