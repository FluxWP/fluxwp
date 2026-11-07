<?php
/** Only loaded by the isolated local QA compose stack. No production data or external service calls. */
if ( ! defined( 'FLUX_NATIVE_QA' ) || ! FLUX_NATIVE_QA || 'local' !== wp_get_environment_type() ) {
    return;
}
add_filter( 'pre_http_request', function () {
    return new WP_Error( 'flux_qa_network_blocked', 'Outbound HTTP is disabled in the isolated FluxWP QA site.' );
}, 1, 3 );
add_filter( 'pre_wp_mail', '__return_true', 1 );
add_filter( 'automatic_updater_disabled', '__return_true' );
add_filter( 'wp_is_application_passwords_available', '__return_true' );
// QA edits retain the release version. Give local assets a content key so browser/SW caches cannot hide an edit.
function flux_qa_asset_url( $url ) {
    $path = wp_parse_url( $url, PHP_URL_PATH );
    if ( ! is_string( $path ) || 0 !== strpos( $path, '/wp-content/plugins/' ) || false !== strpos( $path, '..' ) ) { return $url; }
    $file = ABSPATH . ltrim( $path, '/' );
    return is_file( $file ) ? add_query_arg( 'flux_qa_asset', substr( hash_file( 'sha256', $file ), 0, 12 ), $url ) : $url;
}
add_filter( 'script_loader_src', 'flux_qa_asset_url', 99 );
add_filter( 'style_loader_src', 'flux_qa_asset_url', 99 );
