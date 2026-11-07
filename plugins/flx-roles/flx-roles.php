<?php
/**
 * Plugin Name:       Flux Roles
 * Description:       Personel, İdareci ve Yönetici rollerini ekler (panelden yeni rol de eklenir); rollerin Görev, Sertifika, Bağış, Çağrı Merkezi, Stüdyo ve rapor erişimini tek sayfadan açıp kapatırsınız. Kişisel referans linki ve kullanıcı telefonu (WhatsApp asistanı için) burada.
 * Version:           1.3.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            FluxWP
 * License:           GPL-2.0-or-later
 * Text Domain:       flx-roles
 * Domain Path:       /languages
 * Update URI:        https://updater.fluxwp.com/flx-roles
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/includes/flx-brand/loader.php'; // FluxWP signature (tools/brand).

if ( defined( 'FLXR_VERSION' ) ) {
	return;
}

define( 'FLXR_VERSION', '1.3.0' );
define( 'FLXR_DB_VERSION', 3 );
define( 'FLXR_FILE', __FILE__ );
define( 'FLXR_DIR', plugin_dir_path( __FILE__ ) );
define( 'FLXR_URL', plugin_dir_url( __FILE__ ) );

require_once FLXR_DIR . 'includes/caps.php';
require_once FLXR_DIR . 'includes/referral.php';
require_once FLXR_DIR . 'includes/access.php';
require_once FLXR_DIR . 'includes/phone.php';
require_once FLXR_DIR . 'includes/system-checks.php';
require_once FLXR_DIR . 'includes/app.php';
require_once FLXR_DIR . 'includes/rest.php';
if ( is_admin() ) {
	require_once FLXR_DIR . 'includes/admin.php';
}

/*
 * Çeviri: kaynak metinler Türkçe; site/kullanıcı dili İngilizce olduğunda languages/ içindeki çeviri kullanılır.
 * en_GB, en_AU gibi diğer İngilizce yerel ayarları en_US çevirisine düşer.
 */
add_action(
	'init',
	function () {
		load_plugin_textdomain( 'flx-roles', false, dirname( plugin_basename( FLXR_FILE ) ) . '/languages' );
	},
	1
);
add_filter(
	'load_textdomain_mofile',
	function ( $mofile, $domain ) {
		if ( 'flx-roles' === $domain && ! is_readable( $mofile ) && ! is_readable( str_replace( '.mo', '.l10n.php', $mofile ) ) && preg_match( '/-en_[A-Z]{2}\.mo$/', $mofile ) ) {
			return FLXR_DIR . 'languages/flx-roles-en_US.mo';
		}
		return $mofile;
	},
	10,
	2
);

register_activation_hook( FLXR_FILE, 'flxr_install' );
add_action( 'plugins_loaded', 'flxr_maybe_upgrade', 5 );

function flxr_maybe_upgrade() {
	if ( (int) get_option( 'flxr_db_version' ) < FLXR_DB_VERSION || ! get_role( FLXR_ROLE_STAFF ) || ! get_role( FLXR_ROLE_MANAGER ) || ! get_role( FLXR_ROLE_ADMIN ) ) {
		flxr_install();
	}
}

add_filter(
	'plugin_action_links_' . plugin_basename( FLXR_FILE ),
	function ( $links ) {
		array_unshift( $links, '<a href="' . esc_url( flxr_admin_url() ) . '">' . esc_html__( 'Roller ve erişim', 'flx-roles' ) . '</a>' );
		return $links;
	}
);

/** Güncellemeler ekranında paket logosu. */
add_filter(
	'flxu_package_icons',
	function ( $icons, $slug ) {
		if ( 'flx-roles' === $slug && ! $icons ) {
			$url   = FLXR_URL . 'assets/icon.svg?ver=' . FLXR_VERSION;
			$icons = array( 'svg' => $url, '1x' => $url, '2x' => $url );
		}
		return $icons;
	},
	10,
	2
);
