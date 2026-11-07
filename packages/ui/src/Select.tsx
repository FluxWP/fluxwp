import { Children, Fragment, forwardRef, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState,
  type ChangeEvent, type FocusEvent as ReactFocusEvent, type KeyboardEvent, type ReactNode, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, LoaderCircle, Search, X } from 'lucide-react';
import './select.css';

export interface SelectOption { value: string; label: string; description?: string; group?: string; disabled?: boolean; keywords?: string }
export interface SelectPage { options: SelectOption[]; nextCursor?: string | null }
export interface SelectRemote {
  /** Include the account/resource identity so cached labels cannot cross account boundaries. */
  key: string;
  load(request: { search: string; cursor?: string; signal: AbortSignal }): Promise<SelectPage>;
}
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options?: SelectOption[]; remote?: SelectRemote; searchable?: boolean; placeholder?: string;
  selectedOptions?: SelectOption[]; onValueChange?: (value: string | string[]) => void;
}
const text = (value: ReactNode): string => Children.toArray(value).map(v => typeof v === 'string' || typeof v === 'number' ? String(v) : isValidElement<{children?:ReactNode}>(v) ? text(v.props.children) : '').join('');
function readOptions(children: ReactNode, group?: string): SelectOption[] {
  return Children.toArray(children).flatMap(child => {
    if(!isValidElement<{children?:ReactNode;value?:string|number;label?:string;disabled?:boolean}>(child))return [];
    if(child.type===Fragment)return readOptions(child.props.children,group);
    if(child.type==='optgroup')return readOptions(child.props.children,child.props.label);
    if(child.type!=='option')return [];
    const label=child.props.label??text(child.props.children);return [{value:String(child.props.value??label),label,group,disabled:child.props.disabled}];
  });
}
const fold = (s:string) => s.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/ı/g,'i');
const unique = (options:SelectOption[]) => [...new Map(options.map(o=>[o.value,o])).values()];
const ROW=48;

/** Styled combobox with a real, visually hidden select for forms and React Hook Form refs/events. */
export const Select = forwardRef<HTMLSelectElement,SelectProps>(function Select({children,options:provided,remote,searchable,placeholder,selectedOptions=[],onValueChange,
  value,defaultValue,multiple,disabled,id,className='',style,onChange,onBlur,onFocus,onInvalid,...nativeProps},ref) {
  const {t}=useTranslation(); const uid=useId(); const popupId=`flux-select-${uid}`; const triggerId=id??`${popupId}-trigger`;
  const initial=provided??readOptions(children);
  const [internal,setInternal]=useState<string|string[]>(defaultValue!==undefined?(Array.isArray(defaultValue)?defaultValue.map(String):String(defaultValue)):multiple?[]:initial.find(o=>!o.disabled)?.value??'');
  const current=value!==undefined?value:internal; const selected=(Array.isArray(current)?current:[current]).map(String);
  const [autoLabel,setAutoLabel]=useState('');
  const [open,setOpen]=useState(false); const [search,setSearch]=useState(''); const [active,setActive]=useState(-1); const [scroll,setScroll]=useState(0);
  const [loaded,setLoaded]=useState<SelectOption[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const [next,setNext]=useState<string|null>(null); const [retry,setRetry]=useState(0);
  const [geometry,setGeometry]=useState({left:0,top:0,width:240,height:320});
  const trigger=useRef<HTMLButtonElement>(null); const native=useRef<HTMLSelectElement>(null); const popup=useRef<HTMLDivElement>(null); const list=useRef<HTMLDivElement>(null); const searchInput=useRef<HTMLInputElement>(null);
  useLayoutEffect(()=>{
    if(nativeProps['aria-label']||nativeProps['aria-labelledby'])return;
    const label=native.current?.labels?.[0];if(!label)return;
    const copy=label.cloneNode(true) as HTMLElement;copy.querySelectorAll('.flux-select,input,textarea,button').forEach(node=>node.remove());
    setAutoLabel(copy.textContent?.trim()||'');
  },[children,nativeProps['aria-label'],nativeProps['aria-labelledby']]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  const remoteRef=useRef(remote); remoteRef.current=remote; const request=useRef<AbortController|null>(null); const sequence=useRef(0); const labelCache=useRef(new Map<string,SelectOption>()); const typeahead=useRef({value:'',at:0});
  const staticOptions=provided??readOptions(children); const rows=remote?loaded:staticOptions.filter(o=>!search||fold(`${o.label} ${o.description??''} ${o.group??''} ${o.keywords??''}`).includes(fold(search)));
  for(const o of [...staticOptions,...loaded,...selectedOptions])labelCache.current.set(o.value,o);
  const all=unique([...staticOptions,...loaded,...selected.map(v=>labelCache.current.get(v)??{value:v,label:v})]);
  const showSearch=!!remote||searchable===true||searchable!==false&&staticOptions.length>8;
  const selectedLabels=selected.filter(v=>v!=='').map(v=>labelCache.current.get(v)?.label||v);
  const shown=selectedLabels.length>1?t('selectControl.selected',{count:selectedLabels.length,defaultValue:'{{count}} selected'}):selectedLabels[0]??labelCache.current.get(selected[0]??'')?.label??placeholder??t('selectControl.choose',{defaultValue:'Choose…'});
  const close=(restore=false)=>{setOpen(false);setSearch('');if(restore)trigger.current?.focus();};
  const blur=(event:ReactFocusEvent<HTMLElement>)=>{
    const related=event.relatedTarget as Node|null;
    if(related&&(popup.current?.contains(related)||trigger.current?.contains(related)))return;
    native.current?.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:event.relatedTarget}));
  };
  const select=(option:SelectOption)=>{
    if(option.disabled||disabled)return;
    const values=multiple?(selected.includes(option.value)?selected.filter(v=>v!==option.value):[...selected,option.value]):[option.value];
    const node=native.current;if(!node)return;
    for(const o of node.options)o.selected=values.includes(o.value);
    if(value===undefined)setInternal(multiple?values:values[0]??'');
    // A native change event preserves value/name/currentTarget and registered form handlers.
    node.dispatchEvent(new Event('change',{bubbles:true}));onValueChange?.(multiple?values:values[0]??'');
    if(!multiple)close(true);
  };
  const loadMore=async()=>{
    if(!remoteRef.current||!next||loading)return;
    const controller=new AbortController();request.current?.abort();request.current=controller;const revision=++sequence.current;setLoading(true);setError('');
    try{const page=await remoteRef.current.load({search,cursor:next,signal:controller.signal});if(revision!==sequence.current||controller.signal.aborted)return;setLoaded(old=>unique([...old,...page.options]));setNext(page.nextCursor??null);}
    catch(e){if(!controller.signal.aborted&&revision===sequence.current)setError(e instanceof Error?e.message:String(e));}
    finally{if(revision===sequence.current)setLoading(false);}
  };
  useEffect(()=>{labelCache.current.clear();setLoaded([]);setNext(null);setSearch('');request.current?.abort();++sequence.current;},[remote?.key]);
  useEffect(()=>{
    if(!open||!remoteRef.current)return;
    const controller=new AbortController();request.current?.abort();request.current=controller;const revision=++sequence.current;
    setLoading(true);setLoaded([]);setError('');setNext(null);setActive(-1);setScroll(0);
    const timer=setTimeout(()=>{void remoteRef.current!.load({search,signal:controller.signal}).then(page=>{if(revision===sequence.current&&!controller.signal.aborted){setLoaded(unique(page.options));setNext(page.nextCursor??null);setActive(page.options.findIndex(o=>!o.disabled));}},e=>{if(revision===sequence.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));}).finally(()=>{if(revision===sequence.current&&!controller.signal.aborted)setLoading(false);});},search?220:0);
    return()=>{clearTimeout(timer);controller.abort();};
  },[open,search,remote?.key,retry]);
  useEffect(()=>{if(!open){request.current?.abort();++sequence.current;setLoading(false);return;}const chosen=rows.findIndex(o=>selected.includes(o.value)&&!o.disabled);setActive(chosen>=0?chosen:rows.findIndex(o=>!o.disabled));},[open]);
  useEffect(()=>{if(!remote&&open){setActive(rows.findIndex(o=>!o.disabled));setScroll(0);if(list.current)list.current.scrollTop=0;}},[search]);
  useLayoutEffect(()=>{
    if(!open)return;
    const place=()=>{const rect=trigger.current?.getBoundingClientRect();if(!rect)return;const view=window.visualViewport;const w=view?.width||window.innerWidth;const h=view?.height||window.innerHeight;const offsetTop=view?.offsetTop||0;const offsetLeft=view?.offsetLeft||0;const below=Math.max(0,h+offsetTop-rect.bottom-18);const above=Math.max(0,rect.top-offsetTop-18);const contentHeight=Math.max(1,rows.length)*ROW+10+(showSearch?50:0)+(next||error?44:0);const wanted=Math.min(368,contentHeight);const down=below>=wanted||below>=above;const height=Math.max(48,Math.min(wanted,down?below:above));const width=Math.min(Math.max(rect.width,240),w-24);const top=down?rect.bottom+6:Math.max(offsetTop+12,rect.top-height-6);setGeometry({left:Math.max(offsetLeft+12,Math.min(rect.left,w+offsetLeft-width-12)),top,width,height});};
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
    const observer=new ResizeObserver(place);if(trigger.current)observer.observe(trigger.current);
    const outside=(e:PointerEvent)=>{const node=e.target as Node;if(!trigger.current?.contains(node)&&!popup.current?.contains(node))close();};document.addEventListener('pointerdown',outside,true);
    return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);document.removeEventListener('pointerdown',outside,true);};
  },[open,rows.length,showSearch,next,error]);
  useEffect(()=>{if(open&&showSearch)searchInput.current?.focus();},[open,showSearch]);
  useLayoutEffect(()=>{if(!open||active<0||!list.current)return;const top=active*ROW;const node=list.current;if(top<node.scrollTop)node.scrollTop=top;else if(top+ROW>node.scrollTop+node.clientHeight)node.scrollTop=top+ROW-node.clientHeight;},[active,open]);
  const move=(direction:1|-1,edge?:'first'|'last')=>{
    if(!rows.length)return;let i=edge==='first'?0:edge==='last'?rows.length-1:active+direction;
    for(let n=0;n<rows.length;n++,i+=direction){i=(i+rows.length)%rows.length;if(!rows[i]!.disabled){setActive(i);return;}}
  };
  const keydown=(e:KeyboardEvent<HTMLElement>)=>{
    if(e.key==='Tab'){if(open){close();trigger.current?.focus();}return;}
    if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close(true);return;}
    if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(!open)setOpen(true);else move(e.key==='ArrowDown'?1:-1);return;}
    if(open&&['Home','End'].includes(e.key)){if(e.target===searchInput.current&&search)return;e.preventDefault();move(e.key==='Home'?1:-1,e.key==='Home'?'first':'last');return;}
    if(e.key==='Enter'||e.key===' '&&e.target!==searchInput.current){e.preventDefault();if(!open)setOpen(true);else if(active>=0&&rows[active])select(rows[active]!);return;}
    if(e.target!==searchInput.current&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const now=Date.now();typeahead.current={value:now-typeahead.current.at<650?typeahead.current.value+e.key:e.key,at:now};const needle=fold(typeahead.current.value);const index=rows.findIndex(o=>!o.disabled&&fold(o.label).startsWith(needle));if(index>=0){if(open)setActive(index);else select(rows[index]!);}}
  };
  const windowHeight=Math.max(96,geometry.height-(showSearch?54:0)-(next||error?44:0));
  const virtual=rows.length>100;const start=virtual?Math.max(0,Math.floor(scroll/ROW)-4):0;const end=virtual?Math.min(rows.length,start+Math.ceil(windowHeight/ROW)+9):rows.length;
  const indexes=Array.from({length:Math.max(0,end-start)},(_,i)=>start+i);if(virtual&&active>=0&&!indexes.includes(active))indexes.push(active);
  const portalHost=trigger.current?.closest('dialog')??document.body;
  return <span className="flux-select" style={style}>
    <select {...nativeProps} id={`${triggerId}-input`} ref={node=>{native.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;}} className="flux-select-native" tabIndex={-1} aria-hidden="true" disabled={disabled} multiple={multiple} value={multiple?selected:selected[0]??''}
      onChange={(e:ChangeEvent<HTMLSelectElement>)=>{if(value===undefined)setInternal(multiple?Array.from(e.target.selectedOptions).map(o=>o.value):e.target.value);onChange?.(e);}}
      onFocus={e=>{onFocus?.(e);trigger.current?.focus();}} onBlur={onBlur} onInvalid={e=>{e.preventDefault();trigger.current?.focus();onInvalid?.(e);}}>
      {!all.some(o=>o.value==='')&&<option value="">{placeholder??t('selectControl.choose',{defaultValue:'Choose…'})}</option>}{all.map(o=><option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
    </select>
    <button ref={trigger} id={triggerId} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open?popupId:undefined} aria-activedescendant={open&&active>=0?`${popupId}-${active}`:undefined} aria-label={nativeProps['aria-label']||autoLabel||undefined} aria-labelledby={nativeProps['aria-labelledby']} aria-describedby={nativeProps['aria-describedby']} aria-invalid={nativeProps['aria-invalid']} aria-required={nativeProps.required||undefined} disabled={disabled} onClick={()=>open?close():setOpen(true)} onKeyDown={keydown} onBlur={blur} className={`flux-select-trigger ${className}`}><span className={selectedLabels.length?'':'is-placeholder'}>{shown}</span><ChevronDown size={16} aria-hidden="true"/></button>
    {open&&createPortal(<div ref={popup} className="flux-select-popup" style={{left:geometry.left,top:geometry.top,width:geometry.width,maxHeight:geometry.height}} onKeyDown={keydown} onBlur={blur}>
      {showSearch&&<div className="flux-select-search"><Search size={16} aria-hidden="true"/><input ref={searchInput} role="combobox" aria-label={t('selectControl.search',{defaultValue:'Search options'})} aria-controls={popupId} aria-expanded="true" aria-autocomplete="list" aria-activedescendant={active>=0?`${popupId}-${active}`:undefined} placeholder={t('selectControl.searchPlaceholder',{defaultValue:'Search…'})} value={search} onChange={e=>setSearch(e.target.value)} autoComplete="off" spellCheck={false}/>{search&&<button type="button" aria-label={t('selectControl.clear',{defaultValue:'Clear search'})} onClick={()=>{setSearch('');searchInput.current?.focus();}}><X size={14}/></button>}</div>}
      <div ref={list} id={popupId} role="listbox" aria-label={nativeProps['aria-label']||autoLabel||undefined} aria-multiselectable={multiple||undefined} aria-busy={loading} className="flux-select-list" style={{maxHeight:windowHeight}} onScroll={e=>{setScroll(e.currentTarget.scrollTop);if(next&&!loading&&e.currentTarget.scrollTop+e.currentTarget.clientHeight>=e.currentTarget.scrollHeight-80)void loadMore();}}>
        <div style={virtual?{height:rows.length*ROW,position:'relative'}:undefined}>{indexes.map(i=>{const o=rows[i]!;return <div id={`${popupId}-${i}`} key={o.value} role="option" aria-selected={selected.includes(o.value)} aria-disabled={o.disabled||undefined} aria-setsize={rows.length} aria-posinset={i+1} className={`flux-select-option${i===active?' is-active':''}${o.disabled?' is-disabled':''}`} style={virtual?{position:'absolute',top:i*ROW,left:0,right:0,height:ROW}:undefined} onPointerMove={()=>!o.disabled&&setActive(i)} onPointerDown={e=>e.preventDefault()} onClick={()=>select(o)}><span><strong>{o.label}</strong>{(o.description||o.group)&&<small>{[o.group,o.description].filter(Boolean).join(' · ')}</small>}</span>{selected.includes(o.value)&&<Check size={16} aria-hidden="true"/>}</div>;})}</div>
        {!rows.length&&!loading&&!error&&<div className="flux-select-empty" role="status">{t('selectControl.empty',{defaultValue:'No results'})}</div>}
        {loading&&<div className="flux-select-empty" role="status"><LoaderCircle size={16} className="flux-select-spinner"/>{t('selectControl.loading',{defaultValue:'Loading…'})}</div>}
      </div>
      {error&&<div className="flux-select-error" role="alert"><span>{error}</span><button type="button" onClick={()=>setRetry(n=>n+1)}>{t('selectControl.retry',{defaultValue:'Retry'})}</button></div>}
      {next&&!loading&&!error&&<button className="flux-select-more" type="button" onClick={()=>void loadMore()}>{t('selectControl.more',{defaultValue:'Load more'})}</button>}
    </div>,portalHost)}
  </span>;
});
