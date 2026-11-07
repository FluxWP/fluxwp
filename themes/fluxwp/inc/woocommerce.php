<?php
/**
 * WooCommerce entegrasyonu: Hesabım, sepet, ödeme sayfaları ve header'daki hesap/sepet simgeleri.
 * WooCommerce kapalıysa hiçbir şey yapmaz.
 *
 * @package fluxwp
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Küçük çizgi simgeler (currentColor).
 */
function flx_wc_icon( $name ) {
	$p = array(
		'user'     => '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
		'cart'     => '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.2"/><circle cx="17" cy="20.5" r="1.2"/>',
		'orders'   => '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
		'download' => '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
		'address'  => '<path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
		'card'     => '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
		'account'  => '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.6-1.8 1.9-2.8 3.5-2.8s2.9 1 3.5 2.8M15 9.5h3.5M15 13h3.5"/>',
		'heart'    => '<path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.9-8 10.6-8 10.6z"/>',
		'sprout'   => '<path d="M12 21v-9"/><path d="M12 12c0-4-3-7-8-7 0 4.5 3 7 8 7zM12 10c0-3.5 2.6-6 7-6 0 4-2.6 6-7 6z"/>',
		'item'     => '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12h8M8 15h5"/>',
		'arrow'    => '<path d="M5 12h14m-5-5 5 5-5 5"/>',
		'check'    => '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
	);
	if ( ! isset( $p[ $name ] ) ) {
		return '';
	}
	return '<svg class="flx-ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' . $p[ $name ] . '</svg>';
}

/**
 * "Hesap ve Sepet" bloğu (header): hesap simgesi + WooCommerce mini sepet.
 */
function flx_account_cart_block() {
	if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_page_permalink' ) ) {
		return '';
	}
	$label = is_user_logged_in() ? __( 'My account', 'woocommerce' ) : __( 'Log in', 'woocommerce' );
	$out   = '<div class="flx-hs">';
	$out  .= sprintf(
		'<a class="flx-hs__btn flx-hs__account%3$s" href="%1$s" aria-label="%2$s" title="%2$s">%4$s</a>',
		esc_url( wc_get_page_permalink( 'myaccount' ) ),
		esc_attr( $label ),
		is_user_logged_in() ? ' is-logged-in' : '',
		flx_wc_icon( 'user' )
	);
	$out .= do_blocks( '<!-- wp:woocommerce/mini-cart {"hasHiddenPrice":true,"className":"flx-hs__cart"} /-->' );
	return $out . '</div>';
}

/**
 * Mobil menü açılınca menü kartlarının altında Hesabım, Sepet ve Bağış Yap butonları.
 * Yalnız açılır menüsü olan navigasyona (header) eklenir; sepet sayısı main.js'de header'daki mini sepetten kopyalanır (sayfa önbelleği yüzünden).
 */
function flx_mobile_menu_actions( $html ) {
	if ( false === strpos( $html, 'wp-block-navigation__responsive-container-content' ) || false !== strpos( $html, 'flx-mnav-actions' ) ) {
		return $html;
	}
	$end = strrpos( $html, '</ul>' );
	if ( false === $end ) {
		return $html;
	}
	$donate = function_exists( 'flx_bagis_url' ) ? flx_bagis_url() : home_url( '/bagis/' );
	$out    = '<div class="flx-mnav-actions">';
	if ( class_exists( 'WooCommerce' ) && function_exists( 'wc_get_page_permalink' ) ) {
		$out .= sprintf( '<a class="flx-mnav-btn" href="%s">%s<span>%s</span></a>', esc_url( wc_get_page_permalink( 'myaccount' ) ), flx_wc_icon( 'user' ), esc_html__( 'Hesabım', 'fluxwp' ) );
		$out .= sprintf( '<a class="flx-mnav-btn flx-mnav-cart" href="%s">%s<span>%s</span><b class="flx-mnav-count" hidden></b></a>', esc_url( wc_get_cart_url() ), flx_wc_icon( 'cart' ), esc_html__( 'Sepet', 'fluxwp' ) );
	}
	if ( flx_donation_mode() ) {
		$out .= sprintf( '<a class="flx-mnav-btn flx-mnav-donate" href="%s">%s<span>%s</span></a>', esc_url( $donate ), flx_wc_icon( 'heart' ), esc_html__( 'Bağış Yap', 'fluxwp' ) );
	}
	$out .= '</div>';
	return substr( $html, 0, $end + 5 ) . $out . substr( $html, $end + 5 );
}
add_filter( 'render_block_core/navigation', 'flx_mobile_menu_actions' );

/**
 * WooCommerce kendi hesap/sepet bloklarını header'a otomatik ekliyor (menü ile arama arasına,
 * birbirinden uzak). Tema bunları "Hesap ve Sepet" bloğu ile kendisi yerleştirir.
 */
function flx_wc_unhook_header_blocks( $hooked ) {
	return array_values( array_diff( (array) $hooked, array( 'woocommerce/customer-account', 'woocommerce/mini-cart' ) ) );
}
add_filter( 'hooked_block_types', 'flx_wc_unhook_header_blocks', 99 );

/**
 * Sayfa türü: account | cart | checkout | received | ''.
 */
function flx_wc_context() {
	if ( ! function_exists( 'is_account_page' ) ) {
		return '';
	}
	if ( function_exists( 'is_order_received_page' ) && is_order_received_page() ) {
		return 'received';
	}
	if ( is_account_page() ) {
		return 'account';
	}
	if ( is_cart() ) {
		return 'cart';
	}
	if ( is_checkout() ) {
		return 'checkout';
	}
	return '';
}

function flx_wc_body_class( $classes ) {
	$ctx = flx_wc_context();
	if ( $ctx ) {
		$classes[] = 'flx-wc';
		$classes[] = 'flx-wc--' . $ctx;
	}
	return $classes;
}
add_filter( 'body_class', 'flx_wc_body_class' );

/**
 * WooCommerce sayfaları İngilizce kurulmuşsa ("My account", "Cart"...) başlık o dilde gösterilir.
 * Kalıcı çözüm: Site Kurulumu › Hazır güncellemeler › "Mağaza sayfalarını Türkçeleştir".
 */
function flx_wc_page_title( $title, $id = 0 ) {
	static $ids = null;
	if ( ! $id || ! function_exists( 'wc_get_page_id' ) ) {
		return $title;
	}
	if ( null === $ids ) {
		$ids = array_filter( array_map( 'wc_get_page_id', array( 'myaccount', 'cart', 'checkout', 'shop' ) ) );
	}
	if ( ! in_array( (int) $id, $ids, true ) ) {
		return $title;
	}
	$map = array(
		'My account' => __( 'Hesabım', 'fluxwp' ),
		'My Account' => __( 'Hesabım', 'fluxwp' ),
		'Cart'       => __( 'Sepet', 'fluxwp' ),
		'Checkout'   => __( 'Ödeme', 'fluxwp' ),
		'Shop'       => __( 'Mağaza', 'fluxwp' ),
	);
	return $map[ $title ] ?? $title;
}
add_filter( 'the_title', 'flx_wc_page_title', 5, 2 );

/**
 * Hesap / sepet / ödeme sayfalarında sayfa başlığı yerine tasarımlı başlık alanı.
 */
function flx_wc_hero( $html, $block, $instance = null ) {
	if ( 'core/post-title' !== $block['blockName'] ) {
		return $html;
	}
	$ctx = flx_wc_context();
	if ( ! $ctx || ! is_singular() || did_action( 'flx_wc_hero_done' ) ) {
		return $html;
	}
	if ( $instance instanceof WP_Block && isset( $instance->context['postId'] ) && (int) $instance->context['postId'] !== get_queried_object_id() ) {
		return $html;
	}
	do_action( 'flx_wc_hero_done' );

	$page  = get_the_title( get_queried_object_id() );
	$title = $page;
	$lead  = '';
	$side  = '';
	$icon  = 'cart';

	if ( 'account' === $ctx ) {
		$icon = 'user';
		$ep   = WC()->query->get_current_endpoint();
		if ( ! is_user_logged_in() ) {
			$title = 'lost-password' === $ep ? WC()->query->get_endpoint_title( $ep ) : __( 'Hoş geldiniz', 'fluxwp' );
			$lead  = flx_donation_mode()
				? __( 'Bağışlarınızı, adreslerinizi ve hesap bilgilerinizi yönetmek için giriş yapın ya da birkaç saniyede hesap oluşturun.', 'fluxwp' )
				: __( 'Siparişlerinizi, adreslerinizi ve hesap bilgilerinizi yönetmek için giriş yapın ya da birkaç saniyede hesap oluşturun.', 'fluxwp' );
		} elseif ( $ep && 'dashboard' !== $ep ) {
			$t     = WC()->query->get_endpoint_title( $ep );
			$title = $t ? $t : $page;
		} else {
			$u = wp_get_current_user();
			/* translators: %s: müşterinin adı */
			$title = sprintf( __( 'Merhaba, %s', 'fluxwp' ), $u->first_name ? $u->first_name : $u->display_name );
			$lead  = flx_donation_mode()
				? __( 'Bağışlarınızı takip edin, adreslerinizi ve hesap bilgilerinizi tek yerden yönetin.', 'fluxwp' )
				: __( 'Siparişlerinizi takip edin, adreslerinizi ve hesap bilgilerinizi tek yerden yönetin.', 'fluxwp' );
		}
	} else {
		$steps = array(
			'cart'     => __( 'Sepet', 'fluxwp' ),
			'checkout' => __( 'Ödeme', 'fluxwp' ),
			'received' => __( 'Onay', 'fluxwp' ),
		);
		$keys  = array_keys( $steps );
		$cur   = array_search( $ctx, $keys, true );
		$side  = '<ol class="flx-steps" aria-label="' . esc_attr__( 'Sipariş adımları', 'fluxwp' ) . '">';
		foreach ( $keys as $i => $k ) {
			$state = $i < $cur ? 'is-done' : ( $i === $cur ? 'is-current' : '' );
			$side .= sprintf(
				'<li class="%1$s"%2$s><span class="flx-steps__dot">%3$s</span><span class="flx-steps__label">%4$s</span></li>',
				esc_attr( $state ),
				$i === $cur ? ' aria-current="step"' : '',
				$i < $cur ? flx_wc_icon( 'check' ) : (int) ( $i + 1 ),
				esc_html( $steps[ $k ] )
			);
		}
		$side .= '</ol>';
		if ( 'received' === $ctx ) {
			$icon  = 'check';
			$title = flx_donation_mode() ? __( 'Teşekkürler, bağışınız alındı', 'fluxwp' ) : __( 'Teşekkürler, siparişiniz alındı', 'fluxwp' );
			$lead  = flx_donation_mode() ? __( 'Bağış özetiniz aşağıda. Ayrıntılar e-posta adresinize de gönderildi.', 'fluxwp' ) : __( 'Sipariş özetiniz aşağıda. Ayrıntılar e-posta adresinize de gönderildi.', 'fluxwp' );
		} elseif ( 'checkout' === $ctx ) {
			$icon = 'card';
			$lead = __( 'Bilgilerinizi girin, siparişinizi güvenle tamamlayın.', 'fluxwp' );
		} else {
			$lead = flx_donation_mode() ? __( 'Sepetinizi gözden geçirin; her alışveriş doğaya bir katkı.', 'fluxwp' ) : __( 'Sepetinizi gözden geçirin, ardından ödemeye geçin.', 'fluxwp' );
		}
	}

	ob_start();
	?>
<header class="flx-shop-hero flx-shop-hero--<?php echo esc_attr( $ctx ); ?> alignwide">
	<div class="flx-shop-hero__icon"><?php echo flx_wc_icon( $icon ); // phpcs:ignore WordPress.Security.EscapeOutput ?></div>
	<div class="flx-shop-hero__text">
		<?php if ( $title !== $page ) : ?><p class="flx-shop-hero__eyebrow"><?php echo esc_html( $page ); ?></p><?php endif; ?>
		<h1 class="wp-block-post-title flx-shop-hero__title"><?php echo esc_html( $title ); ?></h1>
		<?php if ( $lead ) : ?><p class="flx-shop-hero__lead"><?php echo esc_html( $lead ); ?></p><?php endif; ?>
	</div>
	<?php echo $side; // phpcs:ignore WordPress.Security.EscapeOutput ?>
</header>
	<?php
	return ob_get_clean();
}
add_filter( 'render_block', 'flx_wc_hero', 20, 3 );

/**
 * Hesabım: sol kolon (profil kartı + menü + bağış kartı).
 */
function flx_wc_account_side_open() {
	$u    = wp_get_current_user();
	$name = trim( $u->first_name . ' ' . $u->last_name );
	$name = $name ? $name : $u->display_name;
	$init = function_exists( 'mb_substr' ) ? mb_strtoupper( mb_substr( $name, 0, 1 ) ) : strtoupper( substr( $name, 0, 1 ) );
	?>
<aside class="flx-account-side">
	<div class="flx-account-user">
		<span class="flx-account-user__avatar" aria-hidden="true"><?php echo esc_html( $init ); ?></span>
		<span class="flx-account-user__meta">
			<strong><?php echo esc_html( $name ); ?></strong>
			<small><?php echo esc_html( $u->user_email ); ?></small>
		</span>
	</div>
	<?php
}
add_action( 'woocommerce_before_account_navigation', 'flx_wc_account_side_open', 1 );

function flx_wc_account_side_close() {
	/**
	 * Hesabım kenar çubuğunun altındaki çağrı kartı: [ 'url', 'title', 'text', 'icon' ]; boş dizi = kart yok.
	 * Bağış modunda bağış sayfasına, mağaza modunda mağazaya gider.
	 */
	$bagis = flx_donation_mode() ? get_page_by_path( 'bagis' ) : null;
	$cta   = $bagis
		? array( 'url' => get_permalink( $bagis ), 'title' => __( 'Bağışa devam et', 'fluxwp' ), 'text' => __( 'Bağış yap', 'fluxwp' ), 'icon' => 'heart' )
		: ( function_exists( 'wc_get_page_permalink' ) ? array( 'url' => wc_get_page_permalink( 'shop' ), 'title' => __( 'Alışverişe devam et', 'fluxwp' ), 'text' => __( 'Mağazaya git', 'fluxwp' ), 'icon' => 'cart' ) : array() );
	$cta   = (array) apply_filters( 'flx_account_cta', $cta );
	?>
	<?php if ( ! empty( $cta['url'] ) ) : ?>
	<a class="flx-account-donate" href="<?php echo esc_url( $cta['url'] ); ?>">
		<?php echo flx_wc_icon( $cta['icon'] ?? 'heart' ); // phpcs:ignore WordPress.Security.EscapeOutput ?>
		<span><strong><?php echo esc_html( $cta['title'] ?? '' ); ?></strong>
		<small><?php echo esc_html( $cta['text'] ?? '' ); ?></small></span>
	</a>
	<?php endif; ?>
</aside>
	<?php
}
add_action( 'woocommerce_after_account_navigation', 'flx_wc_account_side_close', 99 );

/**
 * Pano kartları için simge ve açıklama: array( simge adı (flx_wc_icon), açıklama ).
 * Bilinmeyen uç noktalar (eklentilerin eklediği sekmeler) nötr 'item' simgesi alır.
 * Ön ayarlar `flx_wc_endpoint_meta` filtresiyle değiştirir.
 */
function flx_wc_endpoint_meta( $endpoint ) {
	$m = array(
		'orders'          => flx_donation_mode() ? array( 'heart', __( 'Bağışlarınızı ve durumlarını görün.', 'fluxwp' ) ) : array( 'cart', __( 'Siparişlerinizi ve durumlarını görün.', 'fluxwp' ) ),
		'downloads'       => array( 'download', __( 'Satın aldığınız dosyaları indirin.', 'fluxwp' ) ),
		'edit-address'    => array( 'address', __( 'Fatura ve teslimat adreslerinizi düzenleyin.', 'fluxwp' ) ),
		'payment-methods' => array( 'card', __( 'Kayıtlı ödeme yöntemlerinizi yönetin.', 'fluxwp' ) ),
		'edit-account'    => array( 'account', __( 'Ad, e-posta ve şifrenizi güncelleyin.', 'fluxwp' ) ),
	);
	$meta = $m[ $endpoint ] ?? array( 'item', '' );
	$meta = apply_filters( 'flx_wc_endpoint_meta', $meta, $endpoint );
	return is_array( $meta ) && 2 === count( $meta ) ? array_values( $meta ) : array( 'item', '' );
}

/**
 * Sipariş durum etiketi.
 */
function flx_wc_status_pill( $order ) {
	return sprintf(
		'<span class="flx-status flx-status--%1$s">%2$s</span>',
		esc_attr( $order->get_status() ),
		esc_html( wc_get_order_status_name( $order->get_status() ) )
	);
}

/**
 * Siparişler tablosunda durum sütunu etiket olarak.
 */
function flx_wc_orders_status_column( $order ) {
	echo flx_wc_status_pill( $order ); // phpcs:ignore WordPress.Security.EscapeOutput
}
add_action( 'woocommerce_my_account_my_orders_column_order-status', 'flx_wc_orders_status_column' );

/**
 * Hesabım'da "Siparişler" yerine "Bağışlar" (menü, sayfa başlığı, tablo sütunu).
 */
function flx_wc_account_menu( $items ) {
	if ( isset( $items['orders'] ) && flx_donation_mode() ) {
		$items['orders'] = __( 'Bağışlar', 'fluxwp' );
	}
	return $items;
}
add_filter( 'woocommerce_account_menu_items', 'flx_wc_account_menu', 20 );

add_filter(
	'woocommerce_endpoint_orders_title',
	function ( $title ) {
		return flx_donation_mode() ? __( 'Bağışlar', 'fluxwp' ) : $title;
	}
);

add_filter(
	'woocommerce_account_orders_columns',
	function ( $cols ) {
		if ( isset( $cols['order-number'] ) && flx_donation_mode() ) {
			$cols['order-number'] = __( 'Bağış', 'fluxwp' );
		}
		return $cols;
	}
);

/**
 * Ödeme: "Sepete dön" linki gösterilmez (bağışlar sepete uğramadan doğrudan ödemeye gelir).
 * Geri açmak için: add_filter( 'flx_checkout_return_to_cart', '__return_true' );
 */
add_filter(
	'render_block_data',
	function ( $block ) {
		if ( 'woocommerce/checkout-actions-block' === ( $block['blockName'] ?? '' ) && ! apply_filters( 'flx_checkout_return_to_cart', false ) ) {
			$block['attrs']['showReturnToCart'] = false;
		}
		return $block;
	}
);

/**
 * Mini sepet çekmecesi kapalıyken (aria-hidden="true") içindeki linkler klavye/ajan ile odaklanmasın:
 * çekmeceye `inert` eklenir; WooCommerce'in Interactivity sürümünde açılınca kalkması için bağlanır.
 * (PageSpeed: "ARIA hidden element must not be focusable or contain focusable elements")
 */
add_filter(
	'render_block_woocommerce/mini-cart',
	function ( $html ) {
		if ( false === strpos( $html, 'wc-block-mini-cart__drawer' ) || ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
			return $html;
		}
		$p = new WP_HTML_Tag_Processor( $html );
		while ( $p->next_tag( array( 'class_name' => 'wc-block-mini-cart__drawer' ) ) ) {
			if ( 'true' === $p->get_attribute( 'aria-hidden' ) ) {
				$p->set_attribute( 'inert', true );
			}
			if ( null !== $p->get_attribute( 'data-wp-bind--aria-hidden' ) ) {
				$p->set_attribute( 'data-wp-bind--inert', '!state.isOpen' );
			}
		}
		return $p->get_updated_html();
	}
);

/**
 * Menü bağlantılarında WooCommerce sayfaları için yer tutucu: #wc-shop, #wc-cart, #wc-checkout, #wc-account.
 * Sayfa adresi (ör. /magaza/ ya da /shop/) siteden siteye değiştiği için şablonlarda sabit yazılmaz.
 */
add_filter(
	'render_block_data',
	function ( $block ) {
		if ( 'core/navigation-link' !== ( $block['blockName'] ?? '' ) || ! function_exists( 'wc_get_page_permalink' ) ) {
			return $block;
		}
		$map = array(
			'#wc-shop'     => 'shop',
			'#wc-cart'     => 'cart',
			'#wc-checkout' => 'checkout',
			'#wc-account'  => 'myaccount',
		);
		$url = (string) ( $block['attrs']['url'] ?? '' );
		if ( isset( $map[ $url ] ) ) {
			$block['attrs']['url'] = wc_get_page_permalink( $map[ $url ] );
		}
		return $block;
	}
);

/** Aynı yer tutucular düğme ve paragraf bağlantılarında da (href="#wc-shop"). */
add_filter(
	'render_block',
	function ( $html, $block ) {
		if ( false === strpos( $html, 'href="#wc-' ) || ! function_exists( 'wc_get_page_permalink' ) || 'core/navigation-link' === ( $block['blockName'] ?? '' ) ) {
			return $html;
		}
		return (string) preg_replace_callback(
			'/href="#wc-(shop|cart|checkout|account)"/',
			function ( $m ) {
				return 'href="' . esc_url( wc_get_page_permalink( 'account' === $m[1] ? 'myaccount' : $m[1] ) ) . '"';
			},
			$html
		);
	},
	10,
	2
);

/**
 * Şablon ve desenlerdeki Kısa kod bloğu da çalışsın: blok şablonlarında do_shortcode,
 * desenler açılmadan önce çalıştığı için desen içindeki [products] gibi kısa kodlar ham kalır.
 */
add_filter(
	'render_block_core/shortcode',
	function ( $content ) {
		return false !== strpos( $content, '[' ) ? do_shortcode( $content ) : $content;
	}
);
