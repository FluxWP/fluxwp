// Panelde yerel ekranı olan modüller: uygulamanın kendi ekranları + @fluxwp/modules (WP admin ile ortak).
import type { ComponentType } from 'react';
import type { ModuleInfo } from '@fluxwp/core';
import { moduleScreens } from '@fluxwp/modules';
import { Dashboard } from '../screens/Dashboard';
import { AiScreen } from '../ai/AiWorkspace';
import { RolesScreen } from '../native/RolesScreen';
import { LanguagesScreen } from '../native/LanguagesScreen';
import { SocialComposerScreen } from '../native/SocialComposerScreen';
import { AiBillingScreen } from '../native/AiBillingScreen';
import { AiToolsScreen } from '../native/AiToolsScreen';
import { AiSystemsScreen } from '../native/AiSystemsScreen';
import { AiMcpScreen } from '../native/AiMcpScreen';

/** Sunucuda kaydı olmayan, uygulamanın kendi modülleri (WP çekirdek menülerine bağlanır). */
export const builtinModules: Record<string, ModuleInfo> = {
  'core-dashboard': { title: 'Dashboard', menu: 'index.php', icon: 'dashboard', order: 0 },
};

export const screens: Record<string, ComponentType> = {
  'core-dashboard': Dashboard,
  ...moduleScreens,
  'flxai-chat': AiScreen,
  'flxai-billing': AiBillingScreen,
  'flxai-tools': AiToolsScreen,
  'flxai-systems': AiSystemsScreen,
  'flxai-mcp': AiMcpScreen,
  'flxr-roles': RolesScreen,
  'flxl-languages': LanguagesScreen,
  'flxsm-composer': SocialComposerScreen,
  'flxsm-compose': SocialComposerScreen,
};

export const implemented: ReadonlySet<string> = new Set(Object.keys(screens));
