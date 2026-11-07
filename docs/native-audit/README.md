# Native administration coverage

Generated from all shipped JSON manifests, pure PHP manifest builders and the shared WordPress core manifest. This is an inventory, **not proof of completed native behavior**. Permission checks, API completeness and native runtime QA remain required.

Current app version: `0.3.0`. Modules: 19; screens: 87; explicit web screens: 14; blocked by minimum app version: 81.

| Module / screen | Type | Current source-level status | Source |
| --- | --- | --- | --- |
| lang / settings | native | Version gate; Component registered; runtime QA pending | plugins/flx-lang/app/manifest.json |
| recaptcha / settings | settings | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-recaptcha/app/manifest.json |
| recaptcha / forms | web | Version gate; Requires native implementation | plugins/flx-recaptcha/app/manifest.json |
| backup / list | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-backup/app/manifest.json |
| backup / backup | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-backup/app/manifest.json |
| backup / restore | web | Version gate; Requires native implementation | plugins/flx-backup/app/manifest.json |
| analytics / overview | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-analytics/app/manifest.json |
| analytics / live | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-analytics/app/manifest.json |
| analytics / pages | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-analytics/app/manifest.json |
| analytics / sources | tabs | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-analytics/app/manifest.json |
| analytics / referrers | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-analytics/app/manifest.json |
| analytics / channels | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-analytics/app/manifest.json |
| ai / settings | settings | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-ai/app/manifest.json |
| ai / log | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-ai/app/manifest.json |
| ai / chat | native | Version gate; Component registered; runtime QA pending | plugins/flx-ai/app/manifest.json |
| ai / billing | native | Version gate; Component registered; runtime QA pending | plugins/flx-ai/app/manifest.json |
| ai / systems | native | Version gate; Component registered; runtime QA pending | plugins/flx-ai/app/manifest.json |
| ai / tools | native | Version gate; Component registered; runtime QA pending | plugins/flx-ai/app/manifest.json |
| ai / mcp | native | Version gate; Component registered; runtime QA pending | plugins/flx-ai/app/manifest.json |
| seo / audit | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-seo/app/manifest.json |
| seo / findings | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-seo/app/manifest.json |
| seo / settings | settings | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-seo/app/manifest.json |
| social / posts | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-social/app/manifest.json |
| social / post | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-social/app/manifest.json |
| social / calendar | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-social/app/manifest.json |
| social / accounts | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-social/app/manifest.json |
| social / composer | native | Version gate; Component registered; runtime QA pending | plugins/flx-social/app/manifest.json |
| roles / matrix | native | Version gate; Component registered; runtime QA pending | plugins/flx-roles/app/manifest.json |
| wiki / pages | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-wiki/app/manifest.json |
| wiki / page | content | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-wiki/app/manifest.json |
| wiki / page_form | form | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-wiki/app/manifest.json |
| wiki / search | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-wiki/app/manifest.json |
| studio / gallery | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-studio/app/manifest.json |
| studio / item | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-studio/app/manifest.json |
| setup / packages | web | Version gate; Requires native implementation | plugins/flx-setup/app/manifest.json |
| setup / wizard | web | Version gate; Requires native implementation | plugins/flx-setup/app/manifest.json |
| setup / presets | web | Version gate; Requires native implementation | plugins/flx-setup/app/manifest.json |
| setup / settings | web | Version gate; Requires native implementation | plugins/flx-setup/app/manifest.json |
| speed / summary | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-speed/app/manifest.json |
| speed / slow | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-speed/app/manifest.json |
| speed / request | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-speed/app/manifest.json |
| flxs / overview | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-certificates/includes/app-manifest.php |
| flxs / certificates | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-certificates/includes/app-manifest.php |
| flxs / certificate | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-certificates/includes/app-manifest.php |
| flxs / people | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-certificates/includes/app-manifest.php |
| flxs / queue | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-certificates/includes/app-manifest.php |
| flxs / templates | web | Version gate; Requires native implementation | plugins/flx-certificates/includes/app-manifest.php |
| flxs / create | web | Version gate; Requires native implementation | plugins/flx-certificates/includes/app-manifest.php |
| flxcm / overview | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-commerce/includes/app-manifest.php |
| flxcm / customers | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-commerce/includes/app-manifest.php |
| flxcm / customer | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-commerce/includes/app-manifest.php |
| flxcm / receipts | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-commerce/includes/app-manifest.php |
| flxcm / receipt | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-commerce/includes/app-manifest.php |
| flxcm / settings | web | Version gate; Requires native implementation | plugins/flx-commerce/includes/app-manifest.php |
| crm / overview | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-crm/includes/app-manifest.php |
| crm / contacts | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-crm/includes/app-manifest.php |
| crm / contact | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-crm/includes/app-manifest.php |
| crm / contact_form | form | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-crm/includes/app-manifest.php |
| crm / segments | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-crm/includes/app-manifest.php |
| crm / segment | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-crm/includes/app-manifest.php |
| crm / segment_rules | web | Version gate; Requires native implementation | plugins/flx-crm/includes/app-manifest.php |
| flxb-donations / overview | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb-donations / donations | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb-donations / donation | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb-donations / certificates | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb / overview | dashboard | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb / review | native | Version gate; Component registered; runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb / donations | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb / donation | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb / donors | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb / donor | detail | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb / subscriptions | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-donate/includes/app-manifest.php |
| flxb / types | web | Version gate; Requires native implementation | plugins/flx-donate/includes/app-manifest.php |
| flxb / settings | web | Version gate; Requires native implementation | plugins/flx-donate/includes/app-manifest.php |
| flxi / inbox | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-mail/includes/app-manifest.php |
| flxi / message | content | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-mail/includes/app-manifest.php |
| flxi / reply | form | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-mail/includes/app-manifest.php |
| flxi / log | list | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-mail/includes/app-manifest.php |
| flxi / log_item | content | Version gate; Manifest renderer; API/actions/runtime QA pending | plugins/flx-mail/includes/app-manifest.php |
| flxi / templates | web | Version gate; Requires native implementation | plugins/flx-mail/includes/app-manifest.php |
| flxi / connections | web | Version gate; Requires native implementation | plugins/flx-mail/includes/app-manifest.php |
| core / dashboard | native | Component registered; runtime QA pending | packages/manifest/src/core-manifest.ts |
| core / posts | list | Manifest renderer; API/actions/runtime QA pending | packages/manifest/src/core-manifest.ts |
| core / post | detail | Manifest renderer; API/actions/runtime QA pending | packages/manifest/src/core-manifest.ts |
| core / post_form | form | Manifest renderer; API/actions/runtime QA pending | packages/manifest/src/core-manifest.ts |
| core / pages | list | Manifest renderer; API/actions/runtime QA pending | packages/manifest/src/core-manifest.ts |
| core / comments | list | Manifest renderer; API/actions/runtime QA pending | packages/manifest/src/core-manifest.ts |

## Explicit web actions

Screen types alone miss actions that open a panel page. These are also migration targets.

- recaptcha/open_forms: `admin.php?page=flx-recaptcha`
- backup/restore_web: `admin.php?page=flx-backup`
- analytics/open_panel: `admin.php?page=flx-analytics`
- seo/open_audit: `admin.php?page=flxseo&tab=denetim`
- social/open_panel: `admin.php?page=flx-social`
- wiki/page_web: `post.php?post={{id}}&action=edit`
- studio/open_panel: `admin.php?page=flx-studio`
- speed/open_panel: `admin.php?page=flx-speed`
- flxs/open_create: `admin.php?page=flxs-yeni`
- flxs/open_templates: `admin.php?page=flxs-sablonlar`
- flxcm/open_settings: `admin.php?page=flx-commerce-settings`
- crm/web: `admin.php?page=flx-crm-contacts&id={{data.id}}`
- crm/segment_edit_web: `admin.php?page=flx-crm-segments`
- flxb/open_types: `admin.php?page=flxb-types`
- flxb/open_settings: `admin.php?page=flxb-settings`
- flxi/open_templates: `admin.php?page=flxi`
- flxi/open_connections: `admin.php?page=flxi-baglantilar`
- core/web_post: `post.php?post={{data.id}}&action=edit`

## Plugins without a published manifest

Some have bespoke registered screens; others have no app UI contract. Audit their full admin menu and REST capabilities before implementing.

- flx-updater-manager
- flx-migrate
- flx-app
- flx-forms
- flx-chatbot
- flx-tasks
- flx-chat
- flx-admin

## Scope still open

- Complete all FluxWP leaf pages, forms, settings and actions, including missing native components.
- Audit and integrate WordPress core admin destinations and third-party menus visible on the authorized site.
- AI parity: rich responses/tools, incremental streaming, history lifecycle and settings/admin pages beyond this first chat workspace.
- Resize all remaining module/detail panes and validate narrow/wide windows in the native Mac build.
- Verify translations for dynamic labels and every live leaf screen.
- Resolve release/minimum-version contract only after supported screens and matching API packages are verified.
