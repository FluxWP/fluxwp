// Run with Bun from the repository root after generating the offline PHP inventory.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_MANIFEST } from '../../packages/manifest/src/index.ts';
import { APP_VERSION } from '../../packages/panel/src/version.ts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const phpFile = process.argv[2];
if (!phpFile) throw Error('Usage: bun tools/native-audit/coverage.mjs <offline-php-manifests.json> [output-dir]');
const output = resolve(process.argv[3] || 'docs/native-audit');
const modules = [];
for (const entry of readdirSync(resolve(root, 'plugins'), { withFileTypes: true })) {
 if (!entry.isDirectory()) continue;
 const path = resolve(root, 'plugins', entry.name, 'app/manifest.json');
 try { modules.push({ manifest: JSON.parse(readFileSync(path, 'utf8')), source: relative(root, path) }); }
 catch (error) { if (error.code !== 'ENOENT') throw error; }
}
for (const m of Object.values(JSON.parse(readFileSync(phpFile, 'utf8')).modules)) modules.push({ manifest: m, source: `plugins/${m.plugin}/includes/app-manifest.php` });
modules.push({ manifest: CORE_MANIFEST, source: 'packages/manifest/src/core-manifest.ts' });
const renderer = readFileSync(resolve(root, 'packages/panel/src/renderer.ts'), 'utf8');
const native = new Set([...renderer.match(/NATIVE_SCREENS = \[([^\]]+)/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
const ahead = (minimum) => {
 const a = String(minimum || '0').split('.').map(Number), b = APP_VERSION.split('.').map(Number);
 for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
 return false;
};
const rows = [], webActions = [], noManifest = [];
for (const { manifest: m, source } of modules) {
 for (const [screen, s] of Object.entries(m.screens)) rows.push({ plugin: m.plugin || 'core', module: m.id, screen, type: s.type, source, minimumApp: m.min_app, versionGated: ahead(m.min_app), component: s.component || null, componentRegistered: s.type === 'native' ? native.has(s.component) : null, path: s.path || null, routes: Object.entries(m.routes || {}).filter(([,r]) => r.screen === screen).map(([p]) => p), sources: s.source ? [s.source] : s.sources || [], runtimeVerified: false });
 for (const [id, a] of Object.entries(m.actions || {})) if (a.web) webActions.push({ module: m.id, action: id, web: a.web, source });
}
const represented = new Set(modules.map(({manifest:m}) => m.plugin));
for (const e of readdirSync(resolve(root, 'plugins'), {withFileTypes:true})) if(e.isDirectory() && e.name.startsWith('flx-') && !represented.has(e.name)) noManifest.push(e.name);
const report = { source: 'Offline raw source manifests; capability pruning and live account verification are separate.', appVersion: APP_VERSION, moduleCount: modules.length, screenCount: rows.length, explicitWebCount: rows.filter(r=>r.type === 'web').length, versionGatedScreenCount: rows.filter(r=>r.versionGated).length, missingNativeComponents: rows.filter(r=>r.type === 'native'&&!r.componentRegistered), pluginsWithoutPublishedManifest: noManifest, screens: rows, webActions };
mkdirSync(output,{recursive:true});writeFileSync(resolve(output,'coverage.json'),JSON.stringify(report,null,2)+'\n');
const lines=['# Native administration coverage','','Generated from all shipped JSON manifests, pure PHP manifest builders and the shared WordPress core manifest. This is an inventory, **not proof of completed native behavior**. Permission checks, API completeness and native runtime QA remain required.','','Current app version: `'+APP_VERSION+'`. Modules: '+modules.length+'; screens: '+rows.length+'; explicit web screens: '+report.explicitWebCount+'; blocked by minimum app version: '+report.versionGatedScreenCount+'.','','| Module / screen | Type | Current source-level status | Source |','| --- | --- | --- | --- |'];
for (const r of rows) lines.push(`| ${r.module} / ${r.screen} | ${r.type} | ${r.versionGated?'Version gate; ':''}${r.type==='web'?'Requires native implementation':r.type==='native'?(r.componentRegistered?'Component registered; runtime QA pending':'Missing component '+r.component):'Manifest renderer; API/actions/runtime QA pending'} | ${r.source} |`);
lines.push('','## Explicit web actions','','Screen types alone miss actions that open a panel page. These are also migration targets.','');for (const a of webActions) lines.push(`- ${a.module}/${a.action}: \`${a.web}\``);
lines.push('','## Plugins without a published manifest','','Some have bespoke registered screens; others have no app UI contract. Audit their full admin menu and REST capabilities before implementing.','',...noManifest.map(p=>'- '+p),'','## Scope still open','','- Complete all FluxWP leaf pages, forms, settings and actions, including missing native components.','- Audit and integrate WordPress core admin destinations and third-party menus visible on the authorized site.','- AI parity: rich responses/tools, incremental streaming, history lifecycle and settings/admin pages beyond this first chat workspace.','- Resize all remaining module/detail panes and validate narrow/wide windows in the native Mac build.','- Verify translations for dynamic labels and every live leaf screen.','- Resolve release/minimum-version contract only after supported screens and matching API packages are verified.','');
writeFileSync(resolve(output,'README.md'),lines.join('\n'));console.log(JSON.stringify({modules:report.moduleCount,screens:report.screenCount,web:report.explicitWebCount,versionGated:report.versionGatedScreenCount,missingNativeComponents:report.missingNativeComponents.map(r=>r.component),pluginsWithoutPublishedManifest:noManifest},null,2));
