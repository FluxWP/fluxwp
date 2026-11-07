<?php
// CLI-only inventory of pure manifest builders. No WordPress installation or production requests.
if ( PHP_SAPI !== 'cli' ) { exit( 1 ); }
define( 'ABSPATH', '/audit/' );
function add_action( ...$args ) {}
function add_filter( ...$args ) {}
function __( $text, $domain = '' ) { return $text; }
$root = dirname( __DIR__, 2 );
$builders = [
 'flx-certificates' => [ 'flxs_app_manifest_def' ],
 'flx-commerce' => [ 'flxcm_app_manifest_def' ],
 'flx-crm' => [ 'flxcrm_app_manifest_def' ],
 'flx-donate' => [ 'flxb_app_donor_manifest', 'flxb_app_staff_manifest' ],
 'flx-mail' => [ 'flxi_app_manifest_def' ],
];
$out = [];
foreach ( $builders as $plugin => $functions ) {
 $path = $root . '/plugins/' . $plugin . '/includes/app-manifest.php';
 preg_match_all( '/\bFLX[A-Z_0-9]+\b/', file_get_contents( $path ), $matches );
 foreach ( array_unique( $matches[0] ) as $constant ) {
  if ( ! defined( $constant ) ) { define( $constant, str_ends_with( $constant, '_VERSION' ) ? '0.0.0-audit' : strtolower( $constant ) ); }
 }
 require_once $path;
 foreach ( $functions as $fn ) { $m = $fn(); $out[ $m['id'] ] = $m; }
}
echo json_encode( [ 'note' => 'Raw source manifests; translated text, plugin versions and capabilities are stubbed for offline inventory. Not production/user permission evidence.', 'modules' => $out ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) . "\n";
