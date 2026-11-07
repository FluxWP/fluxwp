# Isolated native integration QA

Run from a local checkout with Docker available:

```sh
python3 tools/native-audit/staging/site.py up --state-dir /absolute/private/qa-state --extras /absolute/wp-extras-checkout
```

`--extras` is optional. State must be outside the repository; its generated `qa.env` is private (0600). Repeating `up` reuses the database and credentials. `stop` stops only this Compose project and keeps its volumes. `status` displays its containers. The only published port is `127.0.0.1:8874`; MariaDB has no published port.

The source plugins are mounted read-only and linked into WordPress. No production site, user data, API keys or mailboxes are copied. The QA-only MU plugin rejects outbound WordPress HTTP requests, suppresses email, disables automatic updates and enables application passwords on the loopback HTTP site. It adds content hashes to local asset URLs so edits are not hidden by browser caches. None of these overrides is included in plugin release ZIPs.

The provisioner activates App, Roles, Languages, Social, AI, Admin, Chat, Tasks and Setup. It does not accept the Setup wizard's legal declaration, enable telemetry, connect external providers or publish social posts. The test administrator is `fluxqa`; its generated password remains in the state file. Do not copy that file into a repository or support report.

Validated on WordPress 7.1.4 / PHP 8.3 / MariaDB 11.4. This environment supports real WordPress/DB regression tests; starting it alone is not proof that every native module has passed integration tests.

Billing regression (after `up`, use the same private state directory):

```sh
docker compose -p fluxwp-native-qa --env-file /absolute/private/qa-state/qa.env -f tools/native-audit/staging/compose.yaml run --rm cli eval-file /opt/fluxwp-public/tools/native-audit/staging/billing-test.php
```

This exercises the actual REST permission callbacks and database: anonymous/subscriber denial, admin totals, a 501-row export with duplicate timestamps, CSV quoting/Unicode/formula handling, month validation, a DST transition month and a fixed quarter-hour timezone. Generated log rows and the disposable subscriber are removed, and the original timezone/current user are restored even if an assertion fails. The test refuses to run outside the isolated local QA environment.

AI tool administration regression:

```sh
docker compose -p fluxwp-native-qa --env-file /absolute/private/qa-state/qa.env -f tools/native-audit/staging/compose.yaml run --rm cli eval-file /opt/fluxwp-public/tools/native-audit/staging/ai-tools-test.php
```

This registers 68 disposable tool definitions without executing their callbacks. It checks permissions, three-page traversal, Unicode search, weighted usage across aliases, provider-secret isolation, complete validation before writes, stale revisions, disabled-state preservation when choosing a competing definition, matching-filter bulk operations with exclusions across pages, inactive-plugin preferences and concurrent-save locking. All test log rows, settings, filters and the temporary subscriber are restored/removed in `finally`. Running with `--context=admin` additionally checks the WordPress tools page against the same catalogue and revision when its renderer is loaded; WordPress CLI may emit core menu warnings in that context.

The native desktop `flxai-tools` screen and mobile Tools screen share their account-scoped query/edit controller. The API exposes tool metadata and a revision; it does not return callbacks, argument schemas or provider keys. Matching-filter selection is resolved by the server rather than only affecting the visible page. Definitions/settings changed elsewhere produce a stale-revision error so they cannot be silently overwritten. The desktop detail pane is resizable; mobile details use the shared dismissible sheet. Demo fixtures exercise the renderer offline; they are not evidence of device behavior or production version-gate activation.

Connected-system SDK regression:

```sh
docker compose -p fluxwp-native-qa --env-file /absolute/private/qa-state/qa.env -f tools/native-audit/staging/compose.yaml run --rm cli eval-file /opt/fluxwp-public/tools/native-audit/staging/ai-systems-test.php
```

This declares 36 temporary SDK systems and every supported field type. It verifies paging/search, administrator-only list/detail/save, complete validation before writes, fractional numeric bounds, text/textarea sanitization, select/toggle/model behavior, unsupported-field isolation, optimistic revisions, unrelated/provider preference preservation and a competing database writer. WordPress list switches and the detail form use the same update/revision guards as the app. The SDK registry, options and test user are restored afterwards. `--context=admin` additionally checks the rendered detail form's revision and unsupported-field isolation when its renderer is loaded.

Desktop `flxai-systems` has a resizable source list and schema-driven form; mobile uses a virtualized list and native form controls. Changes are held per account and require saving/discarding before selecting a different source. The searchable model catalogue also permits manual IDs when catalogue loading fails. The tool link opens native tool administration with the current source filter. These are renderer/database checks; production deployment, compatibility activation, native device checks and the remaining AI administration pages still require verification.

MCP key administration regression:

```sh
docker compose -p fluxwp-native-qa --env-file /absolute/private/qa-state/qa.env -f tools/native-audit/staging/compose.yaml run --rm cli eval-file /opt/fluxwp-public/tools/native-audit/staging/ai-mcp-test.php
docker compose -p fluxwp-native-qa --env-file /absolute/private/qa-state/qa.env -f tools/native-audit/staging/compose.yaml run --rm cli --require=/opt/fluxwp-public/tools/native-audit/staging/ai-mcp-legacy-fixture.php eval-file /opt/fluxwp-public/tools/native-audit/staging/ai-mcp-legacy-test.php
```

These tests exercise administrator-only metadata/mutations, explicit selected/all scopes, aliases, owner permissions, disabled servers/tools, one-time plaintext isolation and no-store headers, legacy migration with a cached-miss/concurrent-writer race, stale revisions, revocation and shared locking with authentication/last-used updates. Only disposable fixture tool callbacks execute; no external client or site tool is run. Options, test users, filters and current user are restored in `finally`. `--context=admin` also checks WordPress forms carry the shared revision. The separate legacy fixture must load before WordPress so it does not recurse through compatibility wrappers; its catalogue stays readable while management mutations are refused.

Desktop `flxai-mcp` has a resizable creation pane. Mobile uses a virtualized searchable tool selector with explicit close controls. Both use the same account-scoped controller, direct POST requests and transient component state for new secrets; plaintext never enters the query or mutation cache. Creating a key leaves the server off unless separately enabled. The server enforces scopes, globally disabled tools and the owner's current capabilities; **external MCP clients are responsible for interactive approval of changes**. Chat-specific approval is not a server-side MCP approval gate. Offline demo keys are clearly fictional, cannot authenticate anywhere, and do not prove native-device or live-site operation.
