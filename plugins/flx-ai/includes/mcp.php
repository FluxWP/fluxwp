<?php
/**
 * Ortak MCP sunucusu (Model Context Protocol, Streamable HTTP, durumsuz).
 *
 * Adres: /wp-json/flx-mcp/v1/mcp
 * Kimlik: "Authorization: Bearer <anahtar>" (Flux AI & MCP › MCP), X-MCP-Key başlığı, ?key= ya da
 *         WordPress Uygulama Parolası (Basic). Araçlar anahtarı oluşturan kullanıcının yetkileriyle çalışır;
 *         anahtara araç listesi verildiyse yalnız o araçlar görünür ve çalışır.
 *
 * Eklentiler araçlarını `flx_mcp_tools` filtresiyle kaydeder (eski ad `flxseo_mcp_tools` da çalışır).
 * Aynı araçlar Flux AI sohbetinde de kullanılır (tools.php).
 *
 * @package FLX_AI
 */

defined( 'ABSPATH' ) || exit;

const FLXAI_MCP_PROTOCOLS = array( '2025-06-18', '2025-03-26', '2024-11-05' );

/**
 * Flux SEO 1.4.x ve öncesi kendi MCP sunucusunu taşıyordu. O sürüm kuruluysa sunucuyu o çalıştırır
 * (aynı REST adresi iki kez kaydedilmesin); Flux AI yalnız uyarı gösterir.
 */
function flxai_mcp_legacy() {
	return function_exists( 'flxseo_mcp_handle' );
}

function flxai_mcp_url() {
	return rest_url( 'flx-mcp/v1/mcp' );
}

function flxai_mcp_admin_url() {
	return admin_url( 'admin.php?page=flx-ai-mcp' );
}

/** MCP sunucusu açık mı? İlk okumada Flux SEO'daki eski aç/kapa değeri devralınır. */
function flxai_mcp_enabled() {
	$s = get_option( 'flxai_settings', array() );
	if ( ! is_array( $s ) || ! array_key_exists( 'mcp_enabled', $s ) ) {
		$old = (array) get_option( 'flxseo', array() );
		return ! empty( $old['mcp_enabled'] );
	}
	return ! empty( $s['mcp_enabled'] );
}

/* ---------------------------------------------------------------------------
 * Anahtarlar
 * ------------------------------------------------------------------------- */

/** Anahtarlar (yalnız özet saklanır). İlk okumada Flux SEO'nun eski anahtarları devralınır; bağlı asistanlar kopmaz. */
function flxai_mcp_keys() {
	$keys = get_option( 'flxai_mcp_keys', null );
	if ( null === $keys ) {
		// Atomic insert: a simultaneous first read must not overwrite a newly created key.
		global $wpdb;
		$wpdb->query( $wpdb->prepare( "INSERT IGNORE INTO {$wpdb->options} (option_name,option_value,autoload) VALUES (%s,%s,%s)", 'flxai_mcp_keys', maybe_serialize( (array) get_option( 'flxseo_mcp_keys', array() ) ), 'no' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		wp_cache_delete( 'flxai_mcp_keys', 'options' ); wp_cache_delete( 'notoptions', 'options' );
		$keys = get_option( 'flxai_mcp_keys', array() );
	}
	return (array) $keys;
}

function flxai_mcp_find_key( $key ) {
	if ( ! $key || strlen( $key ) < 20 ) {
		return null;
	}
	$hash = hash( 'sha256', $key );
	foreach ( flxai_mcp_keys() as $id => $k ) {
		if ( ! empty( $k['hash'] ) && hash_equals( $k['hash'], $hash ) ) {
			return array( 'id' => $id ) + $k;
		}
	}
	return null;
}

function flxai_mcp_refresh_options() {
	wp_cache_delete( 'alloptions', 'options' ); wp_cache_delete( 'flxai_settings', 'options' ); wp_cache_delete( 'flxai_mcp_keys', 'options' ); wp_cache_delete( 'notoptions', 'options' );
	$GLOBALS['flxai_settings_cache'] = null;
}

/** Authenticate and touch a fresh key under the same lock as revocation. Never writes a stale key map. */
function flxai_mcp_authenticated_key( $secret ) {
	if ( ! is_string( $secret ) || strlen( $secret ) < 20 ) { return null; }
	global $wpdb; $lock = flxai_admin_tools_lock_name();
	if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s,0)', $lock ) ) ) { return new WP_Error( 'mcp_busy', __( 'MCP ayarları güncelleniyor. Yeniden deneyin.', 'flx-ai' ), array( 'status' => 503 ) ); }
	try {
		flxai_mcp_refresh_options();
		if ( ! flxai_mcp_enabled() ) { return new WP_Error( 'mcp_disabled', __( 'MCP kapalı.', 'flx-ai' ), array( 'status' => 403 ) ); }
		$key = flxai_mcp_find_key( $secret );
		if ( ! $key ) { return null; }
		if ( time() - (int) ( $key['last_used'] ?? 0 ) > 60 ) {
			$keys = flxai_mcp_keys(); $keys[ $key['id'] ]['last_used'] = time();
			update_option( 'flxai_mcp_keys', $keys, false );
		}
		return $key;
	} finally { $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock ) ); }
}

/**
 * Bu istekteki anahtarın araç listesi. null = sınırsız (anahtar kapsamsız ya da Uygulama Parolası).
 * Yalnız flxai_mcp_permission() ayarlar.
 */
function flxai_mcp_scope( $set = false, $tools = null ) {
	static $scope = null;
	if ( $set ) {
		$scope = $tools;
	}
	return $scope;
}

function flxai_mcp_allowed( $name ) {
	$scope = flxai_mcp_scope();
	return null === $scope || in_array( flxai_tool_resolve( $name ), array_map( 'flxai_tool_resolve', $scope ), true );
}

function flxai_mcp_request_key( WP_REST_Request $req ) {
	$auth = $req->get_header( 'authorization' );
	if ( ! $auth && isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
		$auth = sanitize_text_field( wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) );
	}
	if ( $auth && 0 === stripos( $auth, 'Bearer ' ) ) {
		return trim( substr( $auth, 7 ) );
	}
	if ( $req->get_header( 'x_mcp_key' ) ) {
		return trim( $req->get_header( 'x_mcp_key' ) );
	}
	// Başlık eklenemeyen istemciler (ör. bazı web bağlayıcıları) için gizli adres: ?key=...
	return (string) $req->get_param( 'key' );
}

/* ---------------------------------------------------------------------------
 * Kayıt: araçlar, istemler, kaynaklar, talimatlar
 * ------------------------------------------------------------------------- */

/**
 * Tüm MCP araçları (yetki ve kapalı listesi süzülmeden). Biçim: 'ad' => array( title, description, schema, run( $args ),
 * readonly?, cap?, log?, source?, aliases? ). Kaynaklar: Flux AI SDK (flx_ai_tool), `flx_mcp_tools` ve eski
 * `flxseo_mcp_tools` filtreleri. Aynı adı ikinci bir eklenti kaydederse çakışan tanım ayrılır (registry.php).
 * 'log' => false olan aracın yalnız hatalı çağrıları Son işlemler'e yazılır (ör. TV panelinin dakikalık yoklaması).
 */
function flxai_mcp_tools() {
	if ( flxai_mcp_legacy() && function_exists( 'flxseo_mcp_tools' ) ) {
		$tools = (array) flxseo_mcp_tools();
		return (array) apply_filters( 'flx_mcp_tools', $tools );
	}
	return flxai_mcp_registry()['tools'];
}

/**
 * İstem şablonları (prompts/list). 'ad' => array( title, description, arguments[], text( $args ) → string ).
 */
function flxai_mcp_prompts() {
	$list = (array) apply_filters( 'flx_mcp_prompts', array() );
	return array_filter( $list, fn( $p ) => is_array( $p ) && ! empty( $p['text'] ) && is_callable( $p['text'] ) );
}

/**
 * Kaynaklar (resources/list). 'uri' => array( name, title, description, mimeType, read() → string ).
 * `flx_mcp_resources` ve eski `flxseo_mcp_resources` filtreleri.
 */
function flxai_mcp_resources() {
	$res = (array) apply_filters( 'flx_mcp_resources', array() );
	$res = (array) apply_filters( 'flxseo_mcp_resources', $res );
	return array_filter( $res, fn( $r ) => is_array( $r ) && ! empty( $r['read'] ) && is_callable( $r['read'] ) );
}

/** Sunucu talimatları: genel kurallar + eklentilerin satırları (`flx_mcp_instructions`, satır dizisi). */
function flxai_mcp_instructions() {
	$lines = array(
		sprintf( 'This server manages the WordPress site "%1$s" (%2$s). Site language: %3$s; write content in that language unless the user asks otherwise.', get_bloginfo( 'name' ), home_url( '/' ), get_bloginfo( 'language' ) ),
		'- Tools run with the permissions of the user who created the key. Tools that are not marked read-only change data: tell the user what you are about to do first.',
		'- New content is created as a draft unless the user explicitly asks to publish. Deleting content only moves it to trash.',
	);
	$lines = (array) apply_filters( 'flx_mcp_instructions', $lines );
	return implode( "\n", array_filter( array_map( 'strval', $lines ) ) );
}

/* ---------------------------------------------------------------------------
 * REST
 * ------------------------------------------------------------------------- */

/**
 * Bearer anahtarı olan istekte WordPress'in Basic/çerez kimliğini aramasına gerek yok.
 */
add_filter(
	'determine_current_user',
	function ( $user_id ) {
		if ( $user_id || flxai_mcp_legacy() || empty( $_SERVER['REQUEST_URI'] ) || false === strpos( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ), 'flx-mcp/v1' ) ) {
			return $user_id;
		}
		$auth = sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '' ) );
		$key  = 0 === stripos( $auth, 'Bearer ' ) ? trim( substr( $auth, 7 ) ) : sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_MCP_KEY'] ?? $_GET['key'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
		$k    = flxai_mcp_find_key( $key );
		return $k ? (int) $k['user'] : $user_id;
	},
	30
);

add_action(
	'rest_api_init',
	function () {
		if ( flxai_mcp_legacy() ) {
			return;
		}
		register_rest_route(
			'flx-mcp/v1',
			'/mcp',
			array(
				array(
					'methods'             => 'POST',
					'callback'            => 'flxai_mcp_handle',
					'permission_callback' => 'flxai_mcp_permission',
				),
				array(
					'methods'             => array( 'GET', 'DELETE' ),
					'callback'            => function () {
						return new WP_REST_Response( null, 405 );
					},
					'permission_callback' => '__return_true',
				),
			)
		);
	}
);

function flxai_mcp_permission( WP_REST_Request $req ) {
	if ( ! flxai_mcp_enabled() ) {
		return new WP_Error( 'mcp_disabled', __( 'MCP kapalı. Flux AI & MCP › MCP ekranından açın.', 'flx-ai' ), array( 'status' => 403 ) );
	}
	$secret = flxai_mcp_request_key( $req );
	$k = '' !== $secret ? flxai_mcp_authenticated_key( $secret ) : null;
	if ( is_wp_error( $k ) ) { return $k; }
	// An earlier determine_current_user lookup must not authorize a key revoked since then.
	if ( '' !== $secret && ! $k ) { return new WP_Error( 'mcp_auth', __( 'Geçersiz veya iptal edilmiş MCP anahtarı.', 'flx-ai' ), array( 'status' => 401 ) ); }
	flxai_mcp_scope( true, $k && ! empty( $k['tools'] ) ? array_values( (array) $k['tools'] ) : null );
	if ( $k ) {
		wp_set_current_user( (int) $k['user'] );
	}
	if ( ! is_user_logged_in() ) {
		return new WP_Error( 'mcp_auth', __( 'Geçersiz veya eksik MCP anahtarı.', 'flx-ai' ), array( 'status' => 401 ) );
	}
	if ( ! current_user_can( 'edit_posts' ) ) {
		return new WP_Error( 'mcp_cap', __( 'Bu kullanıcının içerik düzenleme yetkisi yok.', 'flx-ai' ), array( 'status' => 403 ) );
	}
	return true;
}

function flxai_mcp_handle( WP_REST_Request $req ) {
	$body = json_decode( $req->get_body(), true );
	if ( null === $body ) {
		return new WP_REST_Response( flxai_rpc_error( null, -32700, 'Parse error' ), 400 );
	}
	$batch = is_array( $body ) && array() !== $body && array_keys( $body ) === range( 0, count( $body ) - 1 );
	$msgs  = $batch ? $body : array( $body );
	$out   = array();
	foreach ( $msgs as $m ) {
		$r = flxai_mcp_dispatch( $m );
		if ( null !== $r ) {
			$out[] = $r;
		}
	}
	if ( ! $out ) {
		return new WP_REST_Response( null, 202 );
	}
	return new WP_REST_Response( $batch ? $out : $out[0], 200 );
}

function flxai_rpc_error( $id, $code, $msg ) {
	return array(
		'jsonrpc' => '2.0',
		'id'      => $id,
		'error'   => array( 'code' => $code, 'message' => $msg ),
	);
}

function flxai_rpc_result( $id, $result ) {
	return array(
		'jsonrpc' => '2.0',
		'id'      => $id,
		'result'  => $result,
	);
}

function flxai_mcp_dispatch( $m ) {
	if ( ! is_array( $m ) || ( $m['jsonrpc'] ?? '' ) !== '2.0' || empty( $m['method'] ) ) {
		return flxai_rpc_error( $m['id'] ?? null, -32600, 'Invalid Request' );
	}
	$id     = $m['id'] ?? null;
	$params = (array) ( $m['params'] ?? array() );
	if ( ! array_key_exists( 'id', $m ) ) {
		return null; // Bildirim (notifications/initialized vb.): yanıt yok.
	}
	switch ( $m['method'] ) {
		case 'initialize':
			$want = $params['protocolVersion'] ?? '';
			return flxai_rpc_result(
				$id,
				array(
					'protocolVersion' => in_array( $want, FLXAI_MCP_PROTOCOLS, true ) ? $want : FLXAI_MCP_PROTOCOLS[0],
					'capabilities'    => array(
						'tools'     => array( 'listChanged' => false ),
						'prompts'   => array( 'listChanged' => false ),
						'resources' => array( 'listChanged' => false ),
					),
					'serverInfo'      => array(
						'name'    => 'fluxwp',
						'title'   => get_bloginfo( 'name' ) . ' (WordPress)',
						'version' => FLXAI_VERSION,
					),
					'instructions'    => flxai_mcp_instructions(),
				)
			);
		case 'ping':
			return flxai_rpc_result( $id, new stdClass() );
		case 'tools/list':
			$tools = array();
			foreach ( flxai_mcp_tools() as $name => $t ) {
				if ( ! flxai_mcp_allowed( $name ) || flxai_tool_is_off( $name ) || ( ! empty( $t['cap'] ) && ! current_user_can( $t['cap'] ) ) ) {
					continue;
				}
				$tools[] = array(
					'name'        => $name,
					'title'       => $t['title'],
					'description' => $t['description'],
					'inputSchema' => $t['schema'],
					'annotations' => array( 'readOnlyHint' => ! empty( $t['readonly'] ) ),
				);
			}
			return flxai_rpc_result( $id, array( 'tools' => $tools ) );
		case 'tools/call':
			return flxai_rpc_result( $id, flxai_mcp_call( (string) ( $params['name'] ?? '' ), (array) ( $params['arguments'] ?? array() ) ) );
		case 'prompts/list':
			$list = array();
			foreach ( flxai_mcp_prompts() as $name => $p ) {
				$list[] = array(
					'name'        => $name,
					'title'       => $p['title'] ?? $name,
					'description' => $p['description'] ?? '',
					'arguments'   => $p['arguments'] ?? array(),
				);
			}
			return flxai_rpc_result( $id, array( 'prompts' => $list ) );
		case 'prompts/get':
			$p = flxai_mcp_prompts()[ $params['name'] ?? '' ] ?? null;
			if ( ! $p ) {
				return flxai_rpc_error( $id, -32602, 'Unknown prompt' );
			}
			return flxai_rpc_result(
				$id,
				array(
					'description' => $p['description'] ?? '',
					'messages'    => array(
						array(
							'role'    => 'user',
							'content' => array( 'type' => 'text', 'text' => (string) call_user_func( $p['text'], (array) ( $params['arguments'] ?? array() ) ) ),
						),
					),
				)
			);
		case 'resources/list':
			$list = array();
			foreach ( flxai_mcp_resources() as $uri => $r ) {
				$list[] = array(
					'uri'         => $uri,
					'name'        => $r['name'] ?? $uri,
					'title'       => $r['title'] ?? '',
					'description' => $r['description'] ?? '',
					'mimeType'    => $r['mimeType'] ?? 'text/plain',
				);
			}
			return flxai_rpc_result( $id, array( 'resources' => $list ) );
		case 'resources/read':
			$uri = (string) ( $params['uri'] ?? '' );
			$r   = flxai_mcp_resources()[ $uri ] ?? null;
			if ( ! $r || ! current_user_can( $r['cap'] ?? 'edit_posts' ) ) {
				return flxai_rpc_error( $id, -32002, 'Resource not found' );
			}
			return flxai_rpc_result( $id, array( 'contents' => array( array( 'uri' => $uri, 'mimeType' => $r['mimeType'] ?? 'text/plain', 'text' => (string) call_user_func( $r['read'] ) ) ) ) );
		case 'resources/templates/list':
			return flxai_rpc_result( $id, array( 'resourceTemplates' => array() ) );
	}
	return flxai_rpc_error( $id, -32601, 'Method not found: ' . $m['method'] );
}

/**
 * Aracı çalıştırır (MCP ve Flux AI sohbeti ortak). Sonuç MCP biçiminde: content[], isError, structuredContent?.
 */
function flxai_mcp_call( $name, $args ) {
	if ( flxai_mcp_legacy() && function_exists( 'flxseo_mcp_call' ) ) {
		return flxseo_mcp_call( $name, $args );
	}
	$name  = flxai_tool_resolve( $name ); // Eski adla gelen çağrı (ör. site_info → flxseo_site_info).
	$tools = flxai_mcp_tools();
	$ok    = false;
	$t     = null;
	try {
		if ( ! isset( $tools[ $name ] ) ) {
			/* translators: %s: tool name */
			throw new Exception( sprintf( __( 'Bilinmeyen araç: %s', 'flx-ai' ), $name ) );
		}
		if ( flxai_tool_is_off( $name ) ) {
			/* translators: %s: tool name */
			throw new Exception( sprintf( __( 'Bu araç kapalı (Flux AI & MCP › Araçlar): %s', 'flx-ai' ), $name ) );
		}
		if ( ! flxai_mcp_allowed( $name ) ) {
			/* translators: %s: tool name */
			throw new Exception( sprintf( __( 'Bu anahtar bu aracı kullanamaz: %s', 'flx-ai' ), $name ) );
		}
		$t = $tools[ $name ];
		if ( ! empty( $t['cap'] ) && ! current_user_can( $t['cap'] ) ) {
			throw new Exception( __( 'Bu işlem için yetkiniz yok.', 'flx-ai' ) );
		}
		$data = call_user_func( $t['run'], $args );
		$ok   = true;
	} catch ( Throwable $e ) {
		$data = array( 'error' => $e->getMessage() );
	}
	// Sık yoklanan okuma araçları ('log' => false) başarılıysa Son işlemler'i doldurmasın.
	if ( ! $ok || null === $t || false !== ( $t['log'] ?? true ) ) {
		flxai_mcp_log( $name, $ok, $args );
	}
	$res = array(
		'content' => array(
			array(
				'type' => 'text',
				'text' => wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT ),
			),
		),
		'isError' => ! $ok,
	);
	if ( $ok && is_array( $data ) && array() !== $data && array_keys( $data ) !== range( 0, count( $data ) - 1 ) ) {
		$res['structuredContent'] = $data;
	}
	return $res;
}

function flxai_mcp_log( $tool, $ok, $args ) {
	$log    = (array) get_option( 'flxai_mcp_log', array() );
	$target = $args['id'] ?? ( $args['title'] ?? ( $args['search'] ?? '' ) );
	array_unshift(
		$log,
		array(
			't'    => time(),
			'u'    => get_current_user_id(),
			'tool' => $tool,
			'ok'   => $ok,
			'on'   => is_scalar( $target ) ? mb_substr( (string) $target, 0, 80 ) : '',
		)
	);
	update_option( 'flxai_mcp_log', array_slice( $log, 0, 100 ), false );
}

/** Aracı kaydeden eklentinin klasörü (Araçlar ekranındaki "Kaynak" sütunu için). */
function flxai_mcp_tool_source( array $t ) {
	if ( ! empty( $t['source'] ) ) {
		return (string) $t['source'];
	}
	$src = flxai_callable_source( $t['run'] ?? null );
	return '' !== $src ? $src : 'mcp';
}

/* ---------------------------------------------------------------------------
 * Yönetim: aç/kapa, anahtarlar
 * ------------------------------------------------------------------------- */

add_action(
	'admin_post_flxai_mcp',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Yetkisiz.', 'flx-ai' ) );
		}
		check_admin_referer( 'flxai_mcp' );
		$do   = sanitize_key( $_POST['do'] ?? '' );
		$body = array( 'action' => $do, 'revision' => (string) ( $_POST['revision'] ?? '' ) );
		if ( 'toggle' === $do ) { $body['enabled'] = ! empty( $_POST['mcp_enabled'] ); }
		elseif ( 'create' === $do ) {
			$names = array_values( array_map( 'sanitize_key', (array) wp_unslash( $_POST['tools'] ?? array() ) ) );
			$body += array( 'name' => (string) wp_unslash( $_POST['name'] ?? '' ), 'scope' => $names ? 'selected' : 'all', 'tools' => $names );
		} elseif ( 'revoke' === $do ) { $body['id'] = sanitize_text_field( wp_unslash( $_POST['id'] ?? '' ) ); }
		$result = flxai_admin_mcp_update( $body );
		if ( is_wp_error( $result ) ) { wp_die( esc_html( $result->get_error_message() ), '', array( 'response' => (int) ( $result->get_error_data()['status'] ?? 400 ) ) ); }
		if ( isset( $result['created']['secret'] ) ) { set_transient( 'flxai_mcp_new_key_' . get_current_user_id(), $result['created']['secret'], 300 ); }
		wp_safe_redirect( flxai_mcp_admin_url() );
		exit;
	}
);

/* ---------------------------------------------------------------------------
 * Geriye uyum: eski Flux SEO işlevleri (diğer eklentiler function_exists ile denetler)
 * ------------------------------------------------------------------------- */

add_action(
	'plugins_loaded',
	function () {
		if ( flxai_mcp_legacy() ) {
			return;
		}
		if ( ! function_exists( 'flxseo_mcp_tools' ) ) {
			/** @deprecated Flux AI 0.7.0: flxai_mcp_tools(). */
			function flxseo_mcp_tools() {
				return flxai_mcp_tools();
			}
		}
		if ( ! function_exists( 'flxseo_mcp_call' ) ) {
			/** @deprecated Flux AI 0.7.0: flxai_mcp_call(). */
			function flxseo_mcp_call( $name, $args ) {
				return flxai_mcp_call( $name, $args );
			}
		}
		if ( ! function_exists( 'flxseo_mcp_url' ) ) {
			/** @deprecated Flux AI 0.7.0: flxai_mcp_url(). */
			function flxseo_mcp_url() {
				return flxai_mcp_url();
			}
		}
	},
	1
);
