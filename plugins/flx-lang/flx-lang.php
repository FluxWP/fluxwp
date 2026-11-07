<?php
/**
 * Plugin Name:       Flux Lang
 * Description:       Siteyi çok dilli yapar: /en/ gibi dil adresleri, sayfa, yazı, proje ve etkinlik başına çeviri, dile özgü görsel, hreflang ve canonical, Türkiye dışından gelene İngilizce önerisi, dil seçici; Flux AI & MCP ve Flux AI araçlarına dil desteği.
 * Version:           0.2.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            FluxWP
 * License:           GPL-2.0-or-later
 * Text Domain:       flx-lang
 * Domain Path:       /languages
 * Update URI:        https://updater.fluxwp.com/flx-lang
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/includes/flx-brand/loader.php'; // FluxWP signature (tools/brand).

if ( defined( 'FLXL_VERSION' ) ) {
	return;
}

define( 'FLXL_VERSION', '0.2.0' );
define( 'FLXL_FILE', __FILE__ );
define( 'FLXL_DIR', plugin_dir_path( __FILE__ ) );
define( 'FLXL_URL', plugin_dir_url( __FILE__ ) );

require_once FLXL_DIR . 'includes/diller.php';
require_once FLXL_DIR . 'includes/istek.php';
require_once FLXL_DIR . 'includes/icerik.php';
require_once FLXL_DIR . 'includes/baglanti.php';
require_once FLXL_DIR . 'includes/seo.php';
require_once FLXL_DIR . 'includes/secici.php';
require_once FLXL_DIR . 'includes/oneri.php';
require_once FLXL_DIR . 'includes/gorsel.php';
require_once FLXL_DIR . 'includes/terimler.php';
require_once FLXL_DIR . 'includes/ceviri.php';
require_once FLXL_DIR . 'includes/rest.php';
require_once FLXL_DIR . 'includes/araclar.php';
require_once FLXL_DIR . 'includes/woocommerce.php';
require_once FLXL_DIR . 'includes/sistem.php';
require_once FLXL_DIR . 'includes/app.php';
require_once FLXL_DIR . 'includes/native-settings.php';
if ( is_admin() ) {
	require_once FLXL_DIR . 'includes/admin.php';
	require_once FLXL_DIR . 'includes/ayarlar.php';
}

// İstek dili eklenti dosyası yüklenirken belirlenir: tema ve diğer eklentiler çeviri dosyalarını
// yüklemeden önce yerel ayar (locale) hazır olmalı.
flxl_detect_request();

/*
 * Çeviri: kaynak metinler Türkçe; site/kullanıcı dili İngilizce olduğunda languages/ içindeki çeviri kullanılır.
 * en_GB, en_AU gibi diğer İngilizce yerel ayarları en_US çevirisine düşer.
 */
add_action(
	'init',
	function () {
		load_plugin_textdomain( 'flx-lang', false, dirname( plugin_basename( FLXL_FILE ) ) . '/languages' );
	},
	1
);
add_filter(
	'load_textdomain_mofile',
	function ( $mofile, $domain ) {
		if ( 'flx-lang' === $domain && ! is_readable( $mofile ) && ! is_readable( str_replace( '.mo', '.l10n.php', $mofile ) ) && preg_match( '/-en_[A-Z]{2}\.mo$/', $mofile ) ) {
			return FLXL_DIR . 'languages/flx-lang-en_US.mo';
		}
		return $mofile;
	},
	10,
	2
);

register_activation_hook(
	FLXL_FILE,
	function () {
		flxl_register_taxonomy();
		flxl_ensure_terms();
		flxl_index_flush();
	}
);
