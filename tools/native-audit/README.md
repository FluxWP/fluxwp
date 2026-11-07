# Native coverage inventory

From repository root, build the raw PHP manifest snapshot without a running WordPress site:

```sh
mkdir -p /tmp/fluxwp-native-audit
docker run --rm --network none -v "$PWD:/repo:ro" php:8.3-cli php /repo/tools/native-audit/manifests.php > /tmp/fluxwp-native-audit/php-manifests.json
bun tools/native-audit/coverage.mjs /tmp/fluxwp-native-audit/php-manifests.json
```

PHP must be 8.3+ for this inventory helper; this does not change plugin runtime minimums. The helper stubs translations, version constants and capability names and calls pure builders only. It never connects to production, reads credentials or claims live user permissions. JSON manifests and the core TypeScript manifest are read from the checked-out source.

`docs/native-audit/coverage.json` is a source-level inventory. Version gates, web actions, missing components and absent manifests are explicit. Rendering/API coverage, every site-specific submenu and native Mac behavior require further tests. Regenerate when routes/screens or component registration change.
