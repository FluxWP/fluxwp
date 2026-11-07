<?php
/**
 * Hesap girişi:
 * - Bağış sayfasında (hero'nun altında) giriş durumu satırı: Giriş yap / Kayıt ol ya da Hesabım / Çıkış yap.
 *   Kısa kod: [flx_hesap_satiri]
 * - Hesabım'dan giriş/kayıt sonrası geldiği sayfaya dönüş (?flx_donus=/bagis/).
 * - Boş sepetteki "Mağazaya geri dön" → "Bağışlar Sayfasına dön" (bağış sayfasına gider).
 * Giriş/Kayıt sekmeleri ve Google butonunun yeri: assets/js/main.js + theme.css.
 *
 * @package fluxwp
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Bağış sayfasının adresi. */
function flx_bagis_url() {
	foreach ( array( 'bagis', 'bagis-yap', 'fidan-bagisi' ) as $slug ) {
		$p = get_page_by_path( $slug );
		if ( $p && 'publish' === $p->post_status ) {
			return get_permalink( $p );
		}
	}
	return home_url( '/bagis/' );
}

/** Hesabım adresi (WooCommerce yoksa WP girişi). */
function flx_hesap_url() {
	return function_exists( 'wc_get_page_permalink' ) && wc_get_page_id( 'myaccount' ) > 0 ? wc_get_page_permalink( 'myaccount' ) : wp_login_url();
}

function flx_hesap_satiri() {
	$here = is_singular() ? get_permalink() : home_url( add_query_arg( array() ) );
	$rel  = wp_make_link_relative( $here );
	$acc  = flx_hesap_url();
	$ic   = function_exists( 'flx_wc_icon' ) ? flx_wc_icon( 'user' ) : '';
	if ( is_user_logged_in() ) {
		$u    = wp_get_current_user();
		$name = $u->first_name ? $u->first_name : $u->display_name;
		$out  = function_exists( 'wc_logout_url' ) ? wc_logout_url( $here ) : wp_logout_url( $here );
		$txt  = sprintf(
			/* translators: %s: kullanıcı adı */
			esc_html__( 'Merhaba %s, bağışların hesabına kaydedilir.', 'fluxwp' ),
			'<strong>' . esc_html( $name ) . '</strong>'
		);
		$acts = '<a class="flx-hesap-satiri__btn" href="' . esc_url( $acc ) . '">' . esc_html__( 'Hesabım', 'fluxwp' ) . '</a>'
			. '<a class="flx-hesap-satiri__link" href="' . esc_url( $out ) . '">' . esc_html__( 'Çıkış yap', 'fluxwp' ) . '</a>';
	} else {
		$login = add_query_arg( 'flx_donus', rawurlencode( $rel ), $acc );
		$txt   = esc_html__( 'Hesabın var mı? Giriş yaparak bağışlarını hesabından takip edebilirsin.', 'fluxwp' );
		$acts  = '<a class="flx-hesap-satiri__btn" href="' . esc_url( $login ) . '">' . esc_html__( 'Giriş yap', 'fluxwp' ) . '</a>';
		if ( 'yes' === get_option( 'woocommerce_enable_myaccount_registration' ) ) {
			$acts .= '<a class="flx-hesap-satiri__link" href="' . esc_url( $login . '#kayit' ) . '">' . esc_html__( 'Kayıt ol', 'fluxwp' ) . '</a>';
		}
	}
	return '<div class="flx-hesap-satiri alignwide"><span class="flx-hesap-satiri__ic">' . $ic . '</span><p class="flx-hesap-satiri__txt">' . $txt . '</p><div class="flx-hesap-satiri__acts">' . $acts . '</div></div>';
}
add_shortcode( 'flx_hesap_satiri', 'flx_hesap_satiri' );

/** Bağış sayfasında: hero (flx-page-head cover) bitince satır eklenir; hero yoksa içeriğin başına. */
function flx_hesap_satiri_bagis_mi() {
	if ( is_admin() || ! is_page() ) {
		return false;
	}
	$p = get_queried_object();
	return $p && in_array( $p->post_name, array( 'bagis', 'bagis-yap', 'fidan-bagisi' ), true ) && ! has_shortcode( (string) $p->post_content, 'flx_hesap_satiri' );
}

add_filter(
	'render_block_core/cover',
	function ( $html, $block ) {
		static $done = false;
		if ( $done || ! flx_hesap_satiri_bagis_mi() || false === strpos( (string) ( $block['attrs']['className'] ?? '' ), 'flx-page-head' ) ) {
			return $html;
		}
		$done                          = true;
		$GLOBALS['flx_hesap_satiri_ok'] = true;
		return $html . '<div class="flx-hesap-satiri-wrap alignfull">' . flx_hesap_satiri() . '</div>';
	},
	10,
	2
);

add_filter(
	'the_content',
	function ( $c ) {
		if ( ! flx_hesap_satiri_bagis_mi() || ! in_the_loop() || ! is_main_query() || false !== strpos( $c, 'flx-page-head' ) || ! empty( $GLOBALS['flx_hesap_satiri_ok'] ) ) {
			return $c;
		}
		$GLOBALS['flx_hesap_satiri_ok'] = true;
		return '<div class="flx-hesap-satiri-wrap alignfull">' . flx_hesap_satiri() . '</div>' . $c;
	},
	20
);

/* ---------- Giriş / kayıt sonrası geri dönüş ---------- */
function flx_donus_hedefi() {
	$raw = isset( $_REQUEST['flx_donus'] ) ? rawurldecode( wp_unslash( $_REQUEST['flx_donus'] ) ) : ''; // phpcs:ignore WordPress.Security
	if ( '' === $raw ) {
		return '';
	}
	$url = 0 === strpos( $raw, '/' ) ? home_url( $raw ) : $raw;
	return wp_validate_redirect( esc_url_raw( $url ), '' );
}

$flx_donus_input = function () {
	$to = flx_donus_hedefi();
	if ( $to ) {
		echo '<input type="hidden" name="flx_donus" value="' . esc_attr( wp_make_link_relative( $to ) ) . '">';
	}
};
add_action( 'woocommerce_login_form_end', $flx_donus_input );
add_action( 'woocommerce_register_form_end', $flx_donus_input );

add_filter(
	'woocommerce_login_redirect',
	function ( $to ) {
		$d = flx_donus_hedefi();
		return $d ? $d : $to;
	}
);
add_filter(
	'woocommerce_registration_redirect',
	function ( $to ) {
		$d = flx_donus_hedefi();
		return $d ? $d : $to;
	}
);

/* ---------- Boş sepet: "Bağışlar Sayfasına dön" ---------- */
add_filter(
	'woocommerce_return_to_shop_redirect',
	function ( $url ) {
		return flx_donation_mode() ? flx_bagis_url() : $url;
	}
);
add_filter(
	'woocommerce_return_to_shop_text',
	function ( $text ) {
		return flx_donation_mode() ? __( 'Bağışlar Sayfasına dön', 'fluxwp' ) : $text;
	}
);
add_filter(
	'render_block_woocommerce/mini-cart-shopping-button-block',
	function ( $html ) {
		if ( ! flx_donation_mode() ) {
			return $html;
		}
		$html = preg_replace( '/href="[^"]*"/', 'href="' . esc_url( flx_bagis_url() ) . '"', $html, 1 );
		return preg_replace( '/(<div class="wc-block-components-button__text">)[^<]*(<\/div>)/', '$1' . esc_html__( 'Bağışlar Sayfasına dön', 'fluxwp' ) . '$2', $html, 1 );
	}
);

/* JS için: bağış adresi ve metinler (mini sepet istemci tarafında çizildiğinde de değişsin). */
add_action(
	'wp_enqueue_scripts',
	function () {
		$d = array(
			'donateUrl'  => flx_bagis_url(),
			'backToDon'  => flx_donation_mode() ? __( 'Bağışlar Sayfasına dön', 'fluxwp' ) : '',
			'tabLogin'   => __( 'Giriş Yap', 'fluxwp' ),
			'tabReg'     => __( 'Kayıt Ol', 'fluxwp' ),
			'or'         => __( 'veya', 'fluxwp' ),
		);
		wp_add_inline_script( 'fluxwp', 'window.flxHesap=' . wp_json_encode( $d ) . ';', 'before' );
	},
	21
);

/* ---------- Telefon (isteğe bağlı): kayıt formu + Hesap bilgileri → billing_phone ---------- */
/* Sertifika gönderiminde (WhatsApp) hesap sahibinin numarası buradan okunur. */

/** Telefonu temizler; geçersizse false, boşsa ''. */
function flx_telefon_temizle( $raw ) {
	$raw = trim( sanitize_text_field( (string) $raw ) );
	if ( '' === $raw ) {
		return '';
	}
	$digits = preg_replace( '/\D+/', '', $raw );
	if ( strlen( $digits ) < 10 || strlen( $digits ) > 15 || preg_match( '/[^0-9+\s().-]/', $raw ) ) {
		return false;
	}
	return function_exists( 'flxs_normalize_phone' ) ? flxs_normalize_phone( $raw ) : preg_replace( '/[^0-9+]/', '', $raw );
}

function flx_telefon_alani( $id, $value ) {
	?>
	<p class="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide flx-tel-row">
		<label for="<?php echo esc_attr( $id ); ?>"><?php esc_html_e( 'Telefon', 'fluxwp' ); ?> <span class="optional"><?php esc_html_e( '(isteğe bağlı)', 'fluxwp' ); ?></span></label>
		<input type="tel" class="woocommerce-Input woocommerce-Input--text input-text" name="flx_phone" id="<?php echo esc_attr( $id ); ?>" autocomplete="tel" inputmode="tel" placeholder="05XX XXX XX XX" value="<?php echo esc_attr( $value ); ?>">
		<span class="flx-tel-hint"><?php echo esc_html( apply_filters( 'flx_phone_hint_text', __( 'Bağış ve sipariş bildirimlerini WhatsApp’tan da gönderebilmemiz için.', 'fluxwp' ) ) ); ?></span>
	</p>
	<?php
}

add_action(
	'woocommerce_register_form',
	function () {
		flx_telefon_alani( 'reg_flx_phone', isset( $_POST['flx_phone'] ) ? wp_unslash( $_POST['flx_phone'] ) : '' ); // phpcs:ignore WordPress.Security
	}
);
add_filter(
	'woocommerce_registration_errors',
	function ( $errors ) {
		if ( isset( $_POST['flx_phone'] ) && false === flx_telefon_temizle( wp_unslash( $_POST['flx_phone'] ) ) ) { // phpcs:ignore WordPress.Security
			$errors->add( 'flx_phone', __( 'Telefon numarası geçersiz görünüyor. Örnek: 0532 123 45 67', 'fluxwp' ) );
		}
		return $errors;
	}
);
add_action(
	'woocommerce_created_customer',
	function ( $user_id ) {
		$p = isset( $_POST['flx_phone'] ) ? flx_telefon_temizle( wp_unslash( $_POST['flx_phone'] ) ) : ''; // phpcs:ignore WordPress.Security
		if ( $p ) {
			update_user_meta( $user_id, 'billing_phone', $p );
		}
	}
);

/* E-posta alanının hemen altında (WC 8.7+); eski sürümlerde formun sonunda. */
function flx_telefon_hesap_alani() {
	static $done = false;
	if ( $done ) {
		return;
	}
	$done = true;
	flx_telefon_alani( 'account_flx_phone', (string) get_user_meta( get_current_user_id(), 'billing_phone', true ) );
}
add_action( 'woocommerce_edit_account_form_fields', 'flx_telefon_hesap_alani' );
add_action( 'woocommerce_edit_account_form', 'flx_telefon_hesap_alani' );
add_action(
	'woocommerce_save_account_details_errors',
	function ( $errors ) {
		if ( isset( $_POST['flx_phone'] ) && false === flx_telefon_temizle( wp_unslash( $_POST['flx_phone'] ) ) ) { // phpcs:ignore WordPress.Security
			$errors->add( 'flx_phone', __( 'Telefon numarası geçersiz görünüyor. Örnek: 0532 123 45 67', 'fluxwp' ) );
		}
	}
);
add_action(
	'woocommerce_save_account_details',
	function ( $user_id ) {
		if ( ! isset( $_POST['flx_phone'] ) ) { // phpcs:ignore WordPress.Security
			return;
		}
		$p = flx_telefon_temizle( wp_unslash( $_POST['flx_phone'] ) ); // phpcs:ignore WordPress.Security
		if ( '' === $p ) {
			delete_user_meta( $user_id, 'billing_phone' );
		} elseif ( $p ) {
			update_user_meta( $user_id, 'billing_phone', $p );
		}
	}
);

/* Hesabım ana sayfası: telefonu olmayana (ör. Google ile girenler) küçük hatırlatma. */
add_action(
	'flx_hesap_panel_ust',
	function () {
		if ( get_user_meta( get_current_user_id(), 'billing_phone', true ) ) {
			return;
		}
		echo '<div class="flx-tel-nudge"><span class="flx-tel-nudge__ic">' . ( function_exists( 'flx_wc_icon' ) ? flx_wc_icon( 'account' ) : '' ) . '</span><p>'
			. esc_html( apply_filters( 'flx_phone_nudge_text', __( 'Telefon numaranı ekle, bildirimleri WhatsApp’tan da alabilirsin.', 'fluxwp' ) ) )
			. '</p><a class="flx-hesap-satiri__btn" href="' . esc_url( wc_get_account_endpoint_url( 'edit-account' ) ) . '#account_flx_phone">'
			. esc_html__( 'Telefon ekle', 'fluxwp' ) . '</a></div>';
	},
	5
);

/* ---------- Kart ile bağış: Flux Donate (WooCommerce) ---------- */

/**
 * Flux Donate (2.0+) etkin ve kartla bağış formunda gösterilecek bir seçenek varsa true.
 * Bağış sayfasında "flx-soon-only" (yakında) ve "flx-wcb-only" sınıflı bloklar buna göre gösterilir.
 */
function flx_wcb_kart_acik() {
	static $on = null;
	if ( null === $on ) {
		$on = function_exists( 'flxb_wc_form_available' ) && (bool) flxb_wc_form_available();
	}
	return $on;
}

add_filter(
	'render_block',
	function ( $content, $block ) {
		$cls = ' ' . ( $block['attrs']['className'] ?? '' ) . ' ';
		if ( false !== strpos( $cls, ' flx-soon-only ' ) && flx_wcb_kart_acik() ) {
			return '';
		}
		if ( false !== strpos( $cls, ' flx-wcb-only ' ) && ! flx_wcb_kart_acik() ) {
			return '';
		}
		return $content;
	},
	10,
	2
);
