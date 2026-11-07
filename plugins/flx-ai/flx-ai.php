<?php
/**
 * Plugin Name:       Flux AI & MCP
 * Description:       Tüm FluxWP eklentileri için ortak yapay zekâ merkezi: OpenRouter ve Anthropic anahtarları, model kataloğu ve fiyatlar, prompt önbelleği, araç kaydı, ortak MCP sunucusu, kullanım raporları, faturalandırma ve harcama sınırı; yetkili kullanıcılar için admin ve sitede ortak AI sohbeti.
 * Version:           0.9.3
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            FluxWP
 * License:           GPL-2.0-or-later
 * Text Domain:       flx-ai
 * Domain Path:       /languages
 * Update URI:        https://updater.fluxwp.com/flx-ai
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/includes/flx-brand/loader.php'; // FluxWP signature (tools/brand).
require_once __DIR__ . '/includes/flx-ai-sdk/loader.php'; // Flux AI SDK (tools/ai-sdk).
if ( defined( 'FLXAI_VERSION' ) ) {
	return;
}

define( 'FLXAI_VERSION', '0.9.3' );
define( 'FLXAI_DB_VERSION', '3' );
define( 'FLXAI_FILE', __FILE__ );
define( 'FLXAI_DIR', plugin_dir_path( __FILE__ ) );
define( 'FLXAI_URL', plugin_dir_url( __FILE__ ) );

require_once FLXAI_DIR . 'includes/helpers.php';
require_once FLXAI_DIR . 'includes/install.php';
require_once FLXAI_DIR . 'includes/models.php';
require_once FLXAI_DIR . 'includes/providers.php';
require_once FLXAI_DIR . 'includes/budget.php';
require_once FLXAI_DIR . 'includes/api.php';
require_once FLXAI_DIR . 'includes/systems.php';
require_once FLXAI_DIR . 'includes/registry.php';
require_once FLXAI_DIR . 'includes/mcp.php';
require_once FLXAI_DIR . 'includes/tools.php';
require_once FLXAI_DIR . 'includes/chats.php';
require_once FLXAI_DIR . 'includes/widgets.php';
require_once FLXAI_DIR . 'includes/media.php';
require_once FLXAI_DIR . 'includes/agent.php';
require_once FLXAI_DIR . 'includes/reports.php';
require_once FLXAI_DIR . 'includes/app-admin.php';
require_once FLXAI_DIR . 'includes/app-systems.php';
require_once FLXAI_DIR . 'includes/app-mcp.php';
require_once FLXAI_DIR . 'includes/rest.php';
require_once FLXAI_DIR . 'includes/app.php';
require_once FLXAI_DIR . 'includes/dock.php';
require_once FLXAI_DIR . 'includes/checks.php';
require_once FLXAI_DIR . 'includes/js-strings.php';

if ( is_admin() ) {
	require_once FLXAI_DIR . 'includes/admin.php';
	require_once FLXAI_DIR . 'includes/admin-mcp.php';
	require_once FLXAI_DIR . 'includes/admin-tools.php';
	require_once FLXAI_DIR . 'includes/admin-systems.php';
}

/*
 * Çeviri: kaynak metinler Türkçe; en_GB, en_AU gibi İngilizce yerel ayarlar en_US çevirisine düşer.
 */
add_action(
	'init',
	function () {
		load_plugin_textdomain( 'flx-ai', false, dirname( plugin_basename( FLXAI_FILE ) ) . '/languages' );
	},
	1
);
add_filter(
	'load_textdomain_mofile',
	function ( $mofile, $domain ) {
		if ( 'flx-ai' === $domain && ! is_readable( $mofile ) && ! is_readable( str_replace( '.mo', '.l10n.php', $mofile ) ) && preg_match( '/-en_[A-Z]{2}\.mo$/', $mofile ) ) {
			return FLXAI_DIR . 'languages/flx-ai-en_US.mo';
		}
		return $mofile;
	},
	10,
	2
);
add_filter(
	'load_translation_file',
	function ( $file, $domain ) {
		if ( 'flx-ai' === $domain && ! is_readable( $file ) && preg_match( '/-en_[A-Z]{2}\.(l10n\.php|mo)$/', $file, $m ) ) {
			return FLXAI_DIR . 'languages/flx-ai-en_US.' . $m[1];
		}
		return $file;
	},
	10,
	2
);

register_activation_hook( __FILE__, 'flxai_install' );
add_action( 'plugins_loaded', 'flxai_maybe_upgrade' );
