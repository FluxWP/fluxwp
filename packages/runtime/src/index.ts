// @fluxwp/runtime — headless React runtime shared by the Expo app and the desktop/web panel.
// React + TanStack Query + zustand + react-hook-form only: no react-dom, no react-native.
export * from './api';
export * from './brand-gate';
export * from './query';
export * from './scope';
export * from './hooks';
export * from './renderer';
export * from './resolve';
export * from './shell';
export * from './source';
export * from './web-session';
export * from './notify';
export * from './prefs';
export * from './devices';
export * from './upload';
export * from './i18n';
export * from './controllers/context';
export * from './controllers/action';
export * from './controllers/list';
export * from './controllers/detail';
export * from './controllers/form';
export { DEMO_SITE, demoShellFetch } from './demo/fetch';
export { browserPorts, memoryPorts, memoryStore, setTaskLabels, taskText, type LabelFn, type ModulePorts, type NotifyPayload, type SyncStore, type TaskStore } from './modules/ports';
export { WaEngine, type ChatMsgs, type EngineOptions as WaEngineOptions, type WaState } from './modules/whatsapp/engine';
export { notifyIncoming } from './modules/whatsapp/notify';
export {
  FlxgEngine, useEngineVersion, addDays, between, cmpStr, dayKey, norm, parseDay, rank, store as taskStore, today,
  type FlxgState, type Group, type Route as TaskRoute, type Scope as TaskScope,
} from './modules/tasks/engine';
export { parseChecklist, toggleChecklistItem, type CheckItem } from './modules/tasks/checklist';
export { messageText, parseNdjson, readAiStream, streamAiStep, type AiChat, type AiEvent, type AiMessage, type AiPending } from './modules/ai';
export { AiSession, type AiSessionState, type AiDecision, type AiBoot } from './modules/ai-session';
export { mediaForm, mediaThumb, uploadPickedMedia, type MediaFile, type WpMedia } from './modules/media';
export { postBody, postEditPath, type PostDraft, type PostStatus, type WpPost } from './modules/post';
export { socialPostBody, type SocialAccount, type SocialDraft } from './modules/social';
export { studioBusy, studioGenerateBody, type StudioItem, type StudioKind, type StudioModel, type StudioState } from './modules/studio';
export { TV_KEYS, tvCommandAllowed, type TvApp, type TvCommand, type TvState } from './modules/tv';

/** Native screen ids manifests and module targets can open (plan §13 N rows). */
export const NATIVE_SCREEN_IDS = ['flxc-inbox', 'flxg-tasks', 'flxb-review', 'core-post', 'core-media', 'flxsm-compose', 'flxsm-composer', 'studio', 'flx-studio', 'flx-ai', 'flxai-chat', 'flxai-billing', 'flxai-tools', 'flxai-systems', 'flxai-mcp', 'tv-remote', 'flx-tv-remote'] as const;
