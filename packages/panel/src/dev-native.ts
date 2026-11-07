// Local component QA only. This entry is not included in production builds and never selects a live account.
import {accountsStore,loginDemo,setPlatform} from '@fluxwp/core';
import {mountApp,webPlatform} from './index';
import {useRoute} from './state/route';
if(!import.meta.env.DEV||!['localhost','127.0.0.1'].includes(location.hostname))throw new Error('Local development only');
setPlatform(webPlatform);
await accountsStore.getState().load();
if(accountsStore.getState().accounts.some(a=>a.authKind!=='demo'))throw new Error('Use a separate localhost port for demo QA');
await loginDemo();
mountApp(document.getElementById('root')!,webPlatform);

const launch=document.createElement('button');
const requested = new URLSearchParams(location.search).get('component');
const preview = requested === 'flxai-billing' || requested === 'flxai-tools' || requested === 'flxai-systems' || requested === 'flxai-mcp' ? requested : 'flxsm-composer';
launch.textContent=preview==='flxai-mcp'?'MCP yönetimi önizlemesi':preview==='flxai-billing'?'AI faturalandırma önizlemesi':preview==='flxai-systems'?'AI bağlı sistemler önizlemesi':preview==='flxai-tools'?'AI araç yönetimi önizlemesi':'Sosyal gönderi önizlemesi';launch.className='btn-primary';
Object.assign(launch.style,{position:'fixed',right:'16px',top:'12px',zIndex:'10000'});
launch.onclick=()=>{useRoute.getState().go({kind:'native',component:preview,params:{}});launch.remove();};
document.body.appendChild(launch);
