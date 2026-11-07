<?php
/**
 * FluxWP: sade, genel amaçlı WooCommerce block teması.
 * Kuruma özel içerik (logo, renkler, header/footer, ana sayfa, sayfalar) ön ayar eklentilerinden gelir (Flux Setup).
 *
 * @package fluxwp
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/inc/flx-brand/loader.php'; // FluxWP signature (tools/brand).

define( 'FLX_VERSION', '0.7.11' ); // style.css Version ile aynı tutulur (CSS/JS önbelleği bununla yenilenir).

/**
 * Theme supports.
 */
function flx_setup() {
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'editor-styles' );
	add_editor_style( 'assets/css/theme.css' );

	// WooCommerce: plugin kendi block template'lerini bu temanın header/footer'ı ile kullanır.
	add_theme_support( 'woocommerce' );
	add_theme_support( 'wc-product-gallery-zoom' );
	add_theme_support( 'wc-product-gallery-lightbox' );
	add_theme_support( 'wc-product-gallery-slider' );

	// FluxWP altyapısı (flx_img, flx_ayar, kurum profili logosu): ön ayar eklentileri buna bakar.
	add_theme_support( 'flx-theme' );
	// FluxWP signature in the footer (inc/flx-brand): adds a bar if the flx/credit block was removed.
	add_theme_support( 'flx-credit' );
	// Flux Setup'un Ön ayarlar ekranı Görünüm › Tema Ayarları › Ön ayarlar sekmesinde.
	add_theme_support( 'flx-setup-panel', array( 'page' => 'flx-ayarlar', 'arg' => 'bolum', 'value' => 'onayarlar' ) );
}
add_action( 'after_setup_theme', 'flx_setup' );

/**
 * Front-end assets.
 */
function flx_assets() {
	$css = file_exists( get_theme_file_path( 'assets/css/theme.min.css' ) ) ? 'assets/css/theme.min.css' : 'assets/css/theme.css';
	wp_enqueue_style( 'fluxwp', get_theme_file_uri( $css ), array(), FLX_VERSION );
	wp_add_inline_style( 'fluxwp', flx_palette_css() );
	wp_enqueue_script( 'fluxwp', get_theme_file_uri( 'assets/js/main.js' ), array(), FLX_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );

	// Swiper yalnızca sayfada slider varsa yüklenir (bkz. flx_enqueue_slider).
	wp_register_style( 'swiper', get_theme_file_uri( 'assets/vendor/swiper/swiper-bundle.min.css' ), array(), '11.2.10' );
	wp_register_script( 'swiper', get_theme_file_uri( 'assets/vendor/swiper/swiper-bundle.min.js' ), array(), '11.2.10', array( 'strategy' => 'defer', 'in_footer' => true ) );
	wp_register_script( 'fluxwp-slider', get_theme_file_uri( 'assets/js/slider.js' ), array( 'swiper' ), FLX_VERSION, array( 'strategy' => 'defer', 'in_footer' => true ) );
}

/**
 * Renkli SVG simgeleri (CSS değişkeni alamayan data URI'ler) seçili paletin ana rengiyle üretir.
 * Renk Site Editor › Stiller'den, stil varyasyonundan ya da bir ön ayardan değişse de simgeler uyar.
 *
 * @return string
 */
function flx_palette_css() {
	$primary = '';
	$palette = wp_get_global_settings( array( 'color', 'palette' ) );
	foreach ( array( 'custom', 'theme' ) as $origin ) {
		foreach ( (array) ( $palette[ $origin ] ?? array() ) as $c ) {
			if ( ! $primary && 'primary' === ( $c['slug'] ?? '' ) ) {
				$primary = sanitize_hex_color( $c['color'] ?? '' );
			}
		}
	}
	if ( ! $primary ) {
		return '';
	}
	$svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='" . $primary . "' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 21v-9'/><path d='M12 12C7 12 5 9 5 5c5 0 7 3 7 7z'/><path d='M12 10c4 0 7-2 7-6-4 0-7 2-7 6z'/></svg>";
	return ':root{--flx-menu-icon:url("data:image/svg+xml,' . rawurlencode( $svg ) . '")}';
}

/**
 * .flx-slider sınıflı bir grup render edilince Swiper'ı sıraya ekler.
 */
function flx_enqueue_slider( $html, $block ) {
	if ( 'core/group' === $block['blockName'] && ! empty( $block['attrs']['className'] ) && false !== strpos( $block['attrs']['className'], 'flx-slider' ) ) {
		wp_enqueue_style( 'swiper' );
		wp_enqueue_script( 'fluxwp-slider' );
	}
	return $html;
}
add_filter( 'render_block', 'flx_enqueue_slider', 10, 2 );
add_action( 'wp_enqueue_scripts', 'flx_assets' );

/**
 * Pattern category.
 */
function flx_pattern_categories() {
	register_block_pattern_category( 'fluxwp', array( 'label' => __( 'FluxWP', 'fluxwp' ) ) );
}
add_action( 'init', 'flx_pattern_categories' );

/**
 * Simge (icon) block style'ları: editörde Stiller panelinden seçilir.
 */
function flx_block_styles() {
	$icons = array(
		'leaf'     => 'Yaprak',
		'sprout'   => 'Fidan',
		'tree'     => 'Ağaç',
		'users'    => 'Topluluk',
		'heart'    => 'Kalp',
		'calendar' => 'Takvim',
		'recycle'  => 'Geri dönüşüm',
		'cap'      => 'Eğitim',
		'wind'     => 'Rüzgar',
		'pin'      => 'Konum',
		'city'     => 'Şehir',
		'water'    => 'Su',
		'mail'     => 'E-posta',
	);
	foreach ( array( 'core/heading', 'core/paragraph' ) as $block ) {
		foreach ( $icons as $slug => $label ) {
			register_block_style( $block, array( 'name' => 'icon-' . $slug, 'label' => 'Simge: ' . $label ) );
		}
	}
	register_block_style( 'core/group', array( 'name' => 'flx-card', 'label' => 'Kart' ) );
}
add_action( 'init', 'flx_block_styles' );


/**
 * Pattern'lerde kullanılan yardımcılar.
 */
function flx_img( $file ) {
	// Dosya değişince tarayıcı/CDN önbelleği eski görseli göstermesin diye sürüm eki.
	$path = get_theme_file_path( 'assets/images/' . $file );
	$url  = get_theme_file_uri( 'assets/images/' . $file );
	if ( ! file_exists( $path ) ) {
		// Ön ayar eklentileri kendi görsel klasörlerini ekler: [ [ 'path' => …, 'url' => … ], … ].
		foreach ( (array) apply_filters( 'flx_img_dirs', array() ) as $d ) {
			if ( ! empty( $d['path'] ) && file_exists( trailingslashit( $d['path'] ) . $file ) ) {
				$path = trailingslashit( $d['path'] ) . $file;
				$url  = trailingslashit( $d['url'] ) . $file;
				break;
			}
		}
	}
	if ( file_exists( $path ) ) {
		$url = add_query_arg( 'v', filemtime( $path ), $url );
	}
	return esc_url( $url );
}

function flx_cat_id( $slug ) {
	$term = get_term_by( 'slug', $slug, 'category' );
	return $term ? (int) $term->term_id : 0;
}

/**
 * Query Loop için kategori filtresi JSON parçası. Kategori yoksa filtre eklenmez (son yazılar gelir).
 */
function flx_tax_query( $slug ) {
	$id = flx_cat_id( $slug );
	return $id ? ',"taxQuery":{"category":[' . $id . ']}' : '';
}

/**
 * Performans: emoji script/stilleri kapat (sistem emojileri kullanılır).
 */
function flx_disable_emojis() {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'admin_print_scripts', 'print_emoji_detection_script' );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'admin_print_styles', 'print_emoji_styles' );
	remove_filter( 'the_content_feed', 'wp_staticize_emoji' );
	remove_filter( 'comment_text_rss', 'wp_staticize_emoji' );
	remove_filter( 'wp_mail', 'wp_staticize_emoji_for_email' );
	add_filter( 'emoji_svg_url', '__return_false' );
}
add_action( 'init', 'flx_disable_emojis' );

/**
 * Performans: sayfadaki ilk Kapak (hero) görseli hemen ve öncelikli yüklenir (LCP),
 * sonraki kapak görselleri lazy yüklenir. Editörde görsel değişse de çalışır.
 */
function flx_cover_loading( $html, $block ) {
	static $seen = 0;
	if ( 'core/cover' !== $block['blockName'] || false === strpos( $html, 'wp-block-cover__image-background' ) ) {
		return $html;
	}
	++$seen;
	$p = new WP_HTML_Tag_Processor( $html );
	if ( $p->next_tag( array( 'tag_name' => 'img', 'class_name' => 'wp-block-cover__image-background' ) ) ) {
		$p->set_attribute( 'decoding', 'async' );
		if ( 1 === $seen ) {
			$p->remove_attribute( 'loading' );
			$p->set_attribute( 'fetchpriority', 'high' );
		} else {
			$p->set_attribute( 'loading', 'lazy' );
			$p->remove_attribute( 'fetchpriority' );
		}
	}
	return $p->get_updated_html();
}
add_filter( 'render_block', 'flx_cover_loading', 10, 2 );

/**
 * Tema görselleri (pattern'lerdeki img) lazy + async.
 */
function flx_lazy_theme_images( $html, $block ) {
	if ( ! in_array( $block['blockName'], array( 'core/image' ), true ) || false !== strpos( $html, 'loading=' ) ) {
		return $html;
	}
	$p = new WP_HTML_Tag_Processor( $html );
	if ( $p->next_tag( 'img' ) ) {
		$p->set_attribute( 'loading', 'lazy' );
		$p->set_attribute( 'decoding', 'async' );
	}
	return $p->get_updated_html();
}
add_filter( 'render_block', 'flx_lazy_theme_images', 10, 2 );

require get_theme_file_path( 'inc/logo.php' );
require get_theme_file_path( 'inc/hiz.php' );
require get_theme_file_path( 'inc/erisim.php' );
require get_theme_file_path( 'inc/onbellek.php' );
require get_theme_file_path( 'inc/ayarlar.php' );
require get_theme_file_path( 'inc/odeme-logolari.php' );
require get_theme_file_path( 'inc/dil.php' );
require get_theme_file_path( 'inc/woocommerce.php' );
require get_theme_file_path( 'inc/hesap.php' );
require get_theme_file_path( 'inc/sistem.php' );
require get_theme_file_path( 'inc/tasi.php' );

/** Demo ön ayarı (nötr örnek mağaza): Tema Ayarları › Ön ayarlar'da görünür, kendiliğinden uygulanmaz. */
add_filter(
	'flx_presets',
	function ( $presets ) {
		$presets['flux-demo'] = get_theme_file_path( 'preset/preset.json' );
		return $presets;
	}
);
