<?php
/**
 * REST: /wp-json/flx-ai/v1/...
 * Yazma POST; silme POST /delete (bazı sunucular DELETE/PATCH'i kesiyor).
 *
 * @package FLX_AI
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'flxai_rest_routes' );

function flxai_rest_routes() {
	$ns   = 'flx-ai/v1';
	$chat = function () {
		return flxai_can_chat();
	};
	$mng  = function () {
		return flxai_can_manage();
	};
	$r    = function ( $path, $method, $cb, $perm ) use ( $ns ) {
		register_rest_route(
			$ns,
			$path,
			array(
				'methods'             => $method,
				'callback'            => $cb,
				'permission_callback' => $perm,
			)
		);
	};

	$r( '/boot', 'GET', 'flxai_rest_boot', $chat );
	$r( '/chats', 'GET', 'flxai_rest_chats', $chat );
	$r( '/chats/(?P<id>\d+)', 'GET', 'flxai_rest_chat_get', $chat );
	$r( '/chats/(?P<id>\d+)', 'POST', 'flxai_rest_chat_update', $chat );
	$r( '/chats/(?P<id>\d+)/delete', 'POST', 'flxai_rest_chat_delete', $chat );
	$r( '/chats/(?P<id>\d+)/send', 'POST', 'flxai_rest_chat_send', $chat );
	$r( '/chats/(?P<id>\d+)/step', 'POST', 'flxai_rest_chat_step', $chat );
	$r( '/chats/(?P<id>\d+)/decide', 'POST', 'flxai_rest_chat_decide', $chat );
	$r( '/chats/(?P<id>\d+)/stop', 'POST', 'flxai_rest_chat_stop', $chat );
	$r( '/chats/(?P<id>\d+)/rewind', 'POST', 'flxai_rest_chat_rewind', $chat );

	$r( '/models', 'GET', 'flxai_rest_models', $mng );
	$r( '/test', 'POST', 'flxai_rest_test', $mng );
	$r( '/render-test', 'POST', 'flxai_rest_render_test', $mng );
	$r( '/log/(?P<id>\d+)', 'GET', 'flxai_rest_log_body', $mng );
	$r( '/report', 'GET', 'flxai_rest_report', $mng );
	$r( '/billing', 'GET', 'flxai_rest_billing', $mng );
	$r( '/billing/export', 'GET', 'flxai_rest_billing_export', $mng );
	$r( '/credits', 'POST', 'flxai_rest_credits', $mng );
	$r( '/admin/tools', 'GET', 'flxai_admin_tools_get', $mng );
	$r( '/admin/tools', 'POST', 'flxai_admin_tools_post', $mng );
	$r( '/admin/systems', 'GET', 'flxai_admin_systems_get', $mng );
	$r( '/admin/mcp', 'GET', 'flxai_admin_mcp_get', $mng );
	$r( '/admin/mcp', 'POST', 'flxai_admin_mcp_post', $mng );
	$r( '/admin/systems/(?P<source>[a-z0-9_-]+)', 'GET', 'flxai_admin_system_get', $mng );
	$r( '/admin/systems/(?P<source>[a-z0-9_-]+)', 'POST', 'flxai_admin_system_post', $mng );
}

function flxai_rest_chat_or_404( WP_REST_Request $req ) {
	$c = flxai_chat_get( (int) $req['id'] );
	return $c ? $c : new WP_Error( 'flxai_not_found', __( 'Sohbet bulunamadı.', 'flx-ai' ), array( 'status' => 404 ) );
}

function flxai_rest_result( array $res, $since ) {
	return array(
		'state' => $res['state'],
		'chat'  => flxai_chat_public( $res['chat'], $since ),
	);
}

function flxai_rest_boot() {
	$model = flxai_model_for( 'flx-ai', (string) flxai_setting( 'chat_model', '' ) );
	$tools = array();
	foreach ( flxai_tools_for_user() as $name => $t ) {
		$tools[ $name ] = array(
			'title' => (string) $t['title'],
			'write' => flxai_tool_needs_approval( $t ),
		);
	}
	return array(
		'tools'      => $tools,
		'ready'      => flxai_ready( 'flx-ai' ),
		'model'      => $model,
		'modelLabel' => flxai_model_label( $model ),
		'canManage'  => flxai_can_manage(),
		'counts'     => flxai_chat_counts(),
		'budget'     => flxai_can_manage() ? flxai_budget_status() : null,
	);
}

function flxai_rest_chats( WP_REST_Request $req ) {
	return array(
		'chats' => flxai_chat_list(
			array(
				'q'        => (string) $req->get_param( 'q' ),
				'archived' => null === $req->get_param( 'archived' ) ? 0 : (int) $req->get_param( 'archived' ),
				'limit'    => (int) ( $req->get_param( 'limit' ) ?: 50 ),
				'offset'   => (int) $req->get_param( 'offset' ),
			)
		),
	);
}

function flxai_rest_chat_get( WP_REST_Request $req ) {
	$c = flxai_rest_chat_or_404( $req );
	return is_wp_error( $c ) ? $c : flxai_chat_public( $c, (int) $req->get_param( 'since' ) );
}

function flxai_rest_chat_update( WP_REST_Request $req ) {
	$c = flxai_rest_chat_or_404( $req );
	if ( is_wp_error( $c ) ) {
		return $c;
	}
	if ( null !== $req->get_param( 'title' ) ) {
		$c['title'] = sanitize_text_field( (string) $req->get_param( 'title' ) );
	}
	if ( null !== $req->get_param( 'archived' ) ) {
		$c['archived'] = $req->get_param( 'archived' ) ? 1 : 0;
	}
	if ( null !== $req->get_param( 'model' ) && flxai_can_manage() ) {
		$c['model'] = sanitize_text_field( (string) $req->get_param( 'model' ) );
	}
	flxai_chat_save( $c );
	return flxai_chat_public( flxai_chat_get( $c['id'] ), (int) $req->get_param( 'since' ) );
}

function flxai_rest_chat_delete( WP_REST_Request $req ) {
	return array( 'deleted' => flxai_chat_delete( (int) $req['id'] ) );
}

function flxai_rest_chat_send( WP_REST_Request $req ) {
	if ( ! flxai_ready( 'flx-ai' ) ) {
		return new WP_Error( 'flxai_not_ready', __( 'Flux AI henüz ayarlanmadı: Flux AI & MCP › Ayarlar\'dan bir API anahtarı ve model girin.', 'flx-ai' ), array( 'status' => 400 ) );
	}
	$id = (int) $req['id'];
	$c  = $id ? flxai_chat_get( $id ) : flxai_chat_create();
	if ( ! $c ) {
		return new WP_Error( 'flxai_not_found', __( 'Sohbet bulunamadı.', 'flx-ai' ), array( 'status' => 404 ) );
	}
	if ( ! $id && null !== $req->get_param( 'model' ) && flxai_can_manage() ) {
		$c['model'] = sanitize_text_field( (string) $req->get_param( 'model' ) );
	}
	$since = $id ? (int) $req->get_param( 'since' ) : 0;
	$res   = flxai_agent_send( $c, (string) $req->get_param( 'text' ), (array) $req->get_param( 'page' ) );
	return is_wp_error( $res ) ? $res : flxai_rest_result( $res, $since );
}

function flxai_rest_chat_step( WP_REST_Request $req ) {
	$c = flxai_rest_chat_or_404( $req );
	if ( is_wp_error( $c ) ) {
		return $c;
	}
	if ( 'running' !== $c['status'] ) {
		return array( 'state' => 'approval' === $c['status'] ? 'approval' : 'done', 'chat' => flxai_chat_public( $c, (int) $req->get_param( 'since' ) ) );
	}
	$since = (int) $req->get_param( 'since' );
	if ( $req->get_param( 'stream' ) ) {
		flxai_rest_stream_step( $c, $since ); // çıkış yapar
	}
	return flxai_rest_result( flxai_agent_step( $c ), $since );
}

/**
 * Adımı satır satır JSON (NDJSON) olarak akıtır: düşünme/metin/araç parçaları, kayıt değişince sohbet,
 * en sonda { t: result, state, chat }. Sunucu ara belleğe alırsa hepsi sonda gelir; istemci aynı şekilde işler.
 */
function flxai_rest_stream_step( array $c, $since ) {
	@ini_set( 'zlib.output_compression', '0' ); // phpcs:ignore
	@ini_set( 'output_buffering', '0' ); // phpcs:ignore
	@ini_set( 'implicit_flush', '1' ); // phpcs:ignore
	if ( function_exists( 'apache_setenv' ) ) {
		@apache_setenv( 'no-gzip', '1' ); // phpcs:ignore
	}
	while ( ob_get_level() > 0 ) {
		@ob_end_clean(); // phpcs:ignore
	}
	if ( ! headers_sent() ) {
		status_header( 200 );
		header( 'Content-Type: application/x-ndjson; charset=utf-8' );
		header( 'Cache-Control: no-cache, no-store, must-revalidate, private' );
		header( 'X-Accel-Buffering: no' );
		header( 'X-LiteSpeed-Cache-Control: no-cache' );
		header( 'X-Content-Type-Options: nosniff' );
	}
	$out = function ( array $row ) {
		echo wp_json_encode( $row, JSON_UNESCAPED_UNICODE ) . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput
		@flush(); // phpcs:ignore
	};
	// Ara sunucuların tamponunu doldurup ilk parçayı hemen göndermek için boşluk satırı.
	echo str_repeat( ' ', 2048 ) . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput
	@flush(); // phpcs:ignore
	$pend = '';
	$pend_t = '';
	$last = 0.0;
	$send_pending = function () use ( &$pend, &$pend_t, $out ) {
		if ( '' !== $pend ) {
			$out( array( 't' => $pend_t, 'd' => $pend ) );
			$pend = '';
		}
	};
	// Küçük parçalar ~80 ms'de bir birleştirilir (daha az satır, aynı akış hissi).
	$emit = function ( array $ev, $chat = null ) use ( &$pend, &$pend_t, &$last, $out, $send_pending, $since ) {
		$t = (string) ( $ev['t'] ?? '' );
		if ( 'text' === $t || 'think' === $t ) {
			if ( $pend_t !== $t ) {
				$send_pending();
				$pend_t = $t;
			}
			$pend .= (string) ( $ev['d'] ?? '' );
			if ( microtime( true ) - $last > 0.08 ) {
				$send_pending();
				$last = microtime( true );
			}
			return;
		}
		$send_pending();
		if ( 'sync' === $t && is_array( $chat ) ) {
			$out( array( 't' => 'chat', 'chat' => flxai_chat_public( $chat, $since ) ) );
			return;
		}
		$out( $ev );
	};
	$res = flxai_agent_step( $c, $emit );
	$send_pending();
	$out( array_merge( array( 't' => 'result' ), flxai_rest_result( $res, $since ) ) );
	exit;
}

function flxai_rest_chat_decide( WP_REST_Request $req ) {
	$c = flxai_rest_chat_or_404( $req );
	if ( is_wp_error( $c ) ) {
		return $c;
	}
	$d   = array_map( 'sanitize_key', (array) $req->get_param( 'decisions' ) );
	$res = flxai_agent_decide( $c, $d );
	return flxai_rest_result( $res, (int) $req->get_param( 'since' ) );
}

function flxai_rest_chat_stop( WP_REST_Request $req ) {
	$c = flxai_rest_chat_or_404( $req );
	if ( is_wp_error( $c ) ) {
		return $c;
	}
	return array( 'state' => 'done', 'chat' => flxai_chat_public( flxai_agent_stop( $c ), (int) $req->get_param( 'since' ) ) );
}

function flxai_rest_chat_rewind( WP_REST_Request $req ) {
	$c = flxai_rest_chat_or_404( $req );
	if ( is_wp_error( $c ) ) {
		return $c;
	}
	$c = flxai_agent_rewind( $c, sanitize_key( (string) $req->get_param( 'msg' ) ), 'edit' === $req->get_param( 'mode' ) ? 'edit' : 'keep' );
	return is_wp_error( $c ) ? $c : flxai_chat_public( $c, 0 );
}

function flxai_rest_models( WP_REST_Request $req ) {
	$m = flxai_models( (bool) $req->get_param( 'fresh' ) );
	if ( is_wp_error( $m ) ) {
		$m->add_data( array( 'status' => 502 ) );
		return $m;
	}
	$prov = array();
	foreach ( flxai_providers_ready() as $id => $label ) {
		$prov[] = array( 'id' => $id, 'label' => $label );
	}
	return array( 'models' => $m, 'providers' => $prov );
}

function flxai_rest_test( WP_REST_Request $req ) {
	$t = microtime( true );
	$r = flxai_chat(
		array(
			array( 'role' => 'system', 'content' => 'Kısa cevap ver.' ),
			array( 'role' => 'user', 'content' => 'Merhaba! Tek cümleyle kendini tanıt.' ),
		),
		array(
			'source'       => 'flx-ai',
			'purpose'      => 'test',
			'model'        => (string) $req->get_param( 'model' ),
			'max_tokens'   => 80,
			'timeout'      => 30,
			'ignore_limit' => true,
		)
	);
	if ( is_wp_error( $r ) ) {
		$r->add_data( array( 'status' => 400 ) );
		return $r;
	}
	return array(
		'text'  => trim( (string) $r['content'] ),
		'ms'    => (int) ( ( microtime( true ) - $t ) * 1000 ),
		'usage' => $r['_usage'],
	);
}

/**
 * Görsel çevirici testi: örnek bir görseli PNG'ye çevirir. Formdaki adres/kullanıcı/şifre
 * kaydedilmeden denenebilir; şifre boşsa kayıtlı şifre kullanılır. Şifre geri dönmez.
 */
function flxai_rest_render_test( WP_REST_Request $req ) {
	$url  = esc_url_raw( trim( (string) $req->get_param( 'url' ) ), array( 'http', 'https' ) );
	$user = sanitize_text_field( (string) $req->get_param( 'user' ) );
	$pass = (string) $req->get_param( 'pass' );
	$code = '<div style="padding:16px;border-radius:12px;background:var(--accent);color:#fff;font:600 16px/1.4 sans-serif">🌳 Flux AI · ' . esc_html__( 'Görsel çevirici çalışıyor', 'flx-ai' ) . '</div>';
	$svg  = '<svg viewBox="0 0 320 60" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="60" rx="12" fill="#2f7d4f"/><text x="20" y="37" font-family="sans-serif" font-size="16" fill="#fff">Flux AI · ' . esc_html__( 'Görsel çevirici çalışıyor', 'flx-ai' ) . '</text></svg>';
	$t    = microtime( true );
	if ( '' !== $url ) {
		$res = flxai_render_gotenberg(
			flxai_widget_document( $code, false, 360 ),
			360,
			array(
				'url'  => $url,
				'user' => $user,
				'pass' => $pass,
			)
		);
	} elseif ( 'imagick' === flxai_widget_renderer() ) {
		$res = flxai_render_imagick( $svg, 360, false );
	} else {
		$res = new WP_Error( 'flxai_render_unavailable', __( 'Önce Gotenberg adresini girin.', 'flx-ai' ) );
	}
	if ( is_wp_error( $res ) ) {
		$res->add_data( array( 'status' => 400 ) );
		return $res;
	}
	return array(
		'via'   => $res['via'],
		'ms'    => (int) ( ( microtime( true ) - $t ) * 1000 ),
		'bytes' => strlen( $res['data'] ),
		'img'   => 'data:image/png;base64,' . base64_encode( $res['data'] ), // phpcs:ignore
	);
}

/** Kaydın giden/gelen içeriği (maskeli). */
function flxai_rest_log_body( WP_REST_Request $req ) {
	$b = flxai_log_body_get( (int) $req['id'] );
	if ( ! $b ) {
		return new WP_Error( 'flxai_no_body', __( 'Bu kaydın içeriği saklanmamış.', 'flx-ai' ), array( 'status' => 404 ) );
	}
	return $b;
}

function flxai_rest_report( WP_REST_Request $req ) {
	$days = max( 1, min( 365, (int) ( $req->get_param( 'days' ) ?: 30 ) ) );
	return flxai_report( $days, sanitize_key( (string) $req->get_param( 'source' ) ) );
}

function flxai_rest_billing( WP_REST_Request $req ) {
	return array(
		'export_available' => true,
		'month'   => flxai_billing( (string) $req->get_param( 'ym' ) ),
		'months'  => flxai_months( 12 ),
		'budget'  => flxai_budget_status(),
		'credits' => get_option( 'flxai_or_credits', null ),
	);
}

function flxai_rest_billing_export( WP_REST_Request $req ) {
	return flxai_billing_csv( (string) $req->get_param( 'ym' ) );
}

function flxai_rest_credits() {
	$r = flxai_openrouter_credits();
	if ( is_wp_error( $r ) ) {
		$r->add_data( array( 'status' => 400 ) );
	}
	return $r;
}
