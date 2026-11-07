export interface ManagedRole { id: string; label: string; description: string; custom: boolean; count: number; caps: Record<string, boolean> }
export interface RoleCapability { id: string; label: string; locked: boolean; supported: boolean; warning: boolean }
export interface RoleGroup { id: string; label: string; plugin: string; active: boolean; caps: RoleCapability[] }
export interface RoleMatrix {
  roles: ManagedRole[]; groups: RoleGroup[]; settings: { home: Record<string, string>; ref_days: number };
  home_choices: { id: string; label: string }[]; can_promote: boolean; can_list?: boolean; version: string;
}
export interface RoleMatrixPatch { version: string; caps: Record<string, Record<string, boolean>>; home: Record<string, string>; ref_days: number }
export interface RoleMember { id: number; name: string; login: string; email: string; phone: string; protected: boolean; referral: boolean }
export interface RoleMembers { items: RoleMember[]; total: number; page: number; pages: number }
export function roleMatrixPatch(data: RoleMatrix): RoleMatrixPatch {
  return { version: data.version, caps: Object.fromEntries(data.roles.map(r => [r.id, { ...r.caps }])), home: { ...data.settings.home }, ref_days: data.settings.ref_days };
}
