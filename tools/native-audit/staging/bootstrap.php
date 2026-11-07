<?php
/** WP-CLI eval-file --skip-wordpress; never uses the password prompt (which echoes credentials). */
if ( 'cli' !== PHP_SAPI || 'fluxwp_qa' !== getenv( 'WORDPRESS_DB_NAME' ) || ! getenv( 'FLUX_QA_ADMIN_PASSWORD' ) ) {
    throw new RuntimeException( 'The isolated QA environment is required.' );
}
define( 'WP_INSTALLING', true );
define( 'WP_SITEURL', 'http://127.0.0.1:8874' );
define( 'WP_HOME', WP_SITEURL );
require '/var/www/html/wp-load.php';
if ( ! defined( 'FLUX_NATIVE_QA' ) || ! FLUX_NATIVE_QA || 'local' !== wp_get_environment_type() ) {
    throw new RuntimeException( 'Not the local QA site.' );
}
if ( ! is_blog_installed() ) {
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    wp_install( 'FluxWP Native QA', 'fluxqa', 'qa@example.invalid', false, '', getenv( 'FLUX_QA_ADMIN_PASSWORD' ) );
    update_option( 'siteurl', WP_SITEURL );
    update_option( 'home', WP_HOME );
}
echo "Local WordPress is ready.\n";
