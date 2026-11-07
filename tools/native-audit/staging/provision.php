<?php
/** Run with `wp eval-file`; only creates disposable records in the isolated QA database. */
if ( ! defined( 'FLUX_NATIVE_QA' ) || ! FLUX_NATIVE_QA || 'local' !== wp_get_environment_type() || 'http://127.0.0.1:8874' !== get_option( 'home' ) ) {
    throw new RuntimeException( 'This provisioner only runs in the loopback QA site.' );
}
require_once ABSPATH . 'wp-admin/includes/plugin.php';
foreach ( array( 'flx-app', 'flx-roles', 'flx-lang', 'flx-social', 'flx-ai', 'flx-admin', 'flx-chat', 'flx-tasks', 'flx-setup' ) as $slug ) {
    $source = '/opt/fluxwp-public/plugins/' . $slug;
    $link = WP_PLUGIN_DIR . '/' . $slug;
    if ( ! file_exists( $link ) && ! symlink( $source, $link ) ) { throw new RuntimeException( 'Cannot link QA plugin: ' . $slug ); }
    wp_clean_plugins_cache();
    $result = activate_plugin( $slug . '/' . $slug . '.php' );
    if ( is_wp_error( $result ) ) { throw new RuntimeException( $slug . ': ' . $result->get_error_message() ); }
}
update_option( 'timezone_string', 'Europe/Istanbul' );
update_option( 'blog_public', 0 );
// The login secret stays in the generated, host-local env file; never echo it through wp-cli's prompt.
$user = get_user_by( 'login', 'fluxqa' );
if ( ! wp_check_password( getenv( 'FLUX_QA_ADMIN_PASSWORD' ), $user->user_pass, $user->ID ) ) {
    wp_update_user( array( 'ID' => $user->ID, 'user_pass' => getenv( 'FLUX_QA_ADMIN_PASSWORD' ) ) );
}
echo "QA plugins activated; outbound HTTP/email blocked; fictional users only.\n";
