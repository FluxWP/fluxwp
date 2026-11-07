// Custom native screens (`native:<id>` and module ids from plan §13 N rows).
import { lazy, type ComponentType } from 'react';

const inbox = lazy(() => import('./inbox/InboxScreen'));
const tasks = lazy(() => import('./tasks/TasksScreen'));
const review = lazy(() => import('./review/ReviewScreen'));
const post = lazy(() => import('./post/PostScreen'));
const media = lazy(() => import('./media/MediaScreen'));
const social = lazy(() => import('./social/SocialScreen'));
const studio = lazy(() => import('./studio/StudioScreen'));
const ai = lazy(() => import('./ai/AiScreen'));
const tv = lazy(() => import('./tv/TvScreen'));

export const NATIVE: Record<string, ComponentType<{ params: Record<string, string> }>> = {
  dashboard: lazy(() => import('./dashboard')),
  'flxc-inbox': inbox,
  'flxg-tasks': tasks,
  'flxb-review': review,
  'core-post': post,
  'core-media': media,
  'flxsm-compose': social,
  'flxsm-composer': social,
  studio,
  'flx-studio': studio,
  'flx-ai': ai,
  'flxai-chat': ai,
  'flxai-billing': lazy(() => import('./ai/BillingScreen')),
  'flxai-tools': lazy(() => import('./ai/ToolsScreen')),
  'flxai-systems': lazy(() => import('./ai/SystemsScreen')),
  'flxai-mcp': lazy(() => import('./ai/McpScreen')),
  'tv-remote': tv,
  'flx-tv-remote': tv,
};
