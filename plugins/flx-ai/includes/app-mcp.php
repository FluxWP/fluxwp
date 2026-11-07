<?php
/** Administrator MCP contract. Secrets are returned once, never in snapshots. */
defined( 'ABSPATH' ) || exit;

function flxai_admin_mcp_snapshot() {
	flxai_chat_registry( true );
	$tools = array();
	foreach ( flxai_mcp_tools() as $name => $tool ) {
		$source = flxai_mcp_tool_source( $tool ); $info = flxai_source_info( $source );
		$tools[] = array( 'name' => (string) $name, 'title' => (string) ( $tool['title'] ?? $name ), 'description' => (string) ( $tool['description'] ?? '' ), 'source' => $source, 'label' => $info['label'], 'readonly' => ! empty( $tool['readonly'] ), 'off' => flxai_tool_is_off( $name ), 'allowed' => empty( $tool['cap'] ) || current_user_can( $tool['cap'] ) );
	}
	$keys = array(); $versioned = array();
	foreach ( flxai_mcp_keys() as $id => $key ) {
		$owner = get_userdata( (int) ( $key['user'] ?? 0 ) );
		$keys[] = array( 'id' => (string) $id, 'name' => (string) ( $key['name'] ?? '' ), 'hint' => (string) ( $key['hint'] ?? '' ), 'user' => (int) ( $key['user'] ?? 0 ), 'owner' => $owner ? $owner->user_login : '', 'created' => (int) ( $key['created'] ?? 0 ), 'last_used' => (int) ( $key['last_used'] ?? 0 ), 'tools' => ! empty( $key['tools'] ) ? array_values( array_map( 'strval', (array) $key['tools'] ) ) : null );
		unset( $key['last_used'] ); $versioned[ $id ] = $key;
	}
	ksort( $versioned );
	$log = array();
	foreach ( array_slice( (array) get_option( 'flxai_mcp_log', array() ), 0, 20 ) as $entry ) {
		$owner = get_userdata( (int) ( $entry['u'] ?? 0 ) );
		$log[] = array( 'at' => (int) ( $entry['t'] ?? 0 ), 'owner' => $owner ? $owner->user_login : '', 'tool' => (string) ( $entry['tool'] ?? '' ), 'target' => (string) ( $entry['on'] ?? '' ), 'ok' => ! empty( $entry['ok'] ) );
	}
	$enabled = flxai_mcp_enabled(); $legacy = flxai_mcp_legacy();
	return array( 'revision' => hash_hmac( 'sha256', wp_json_encode( array( $enabled, $legacy, $versioned, $tools ) ), wp_salt( 'nonce' ) ), 'enabled' => $enabled, 'legacy' => $legacy, 'url' => flxai_mcp_url(), 'slug' => sanitize_title( get_bloginfo( 'name' ) ) ?: 'fluxwp', 'keys' => $keys, 'tools' => $tools, 'log' => $log );
}

function flxai_admin_mcp_get() { return flxai_admin_mcp_snapshot(); }

/** All management writers share the lock also used by key authentication/last-used updates. */
function flxai_admin_mcp_update( array $body ) {
	if ( ! flxai_can_manage() ) { return new WP_Error( 'mcp_forbidden', __( 'Yetkiniz yok.', 'flx-ai' ), array( 'status' => 403 ) ); }
	global $wpdb; $lock = flxai_admin_tools_lock_name();
	if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s,0)', $lock ) ) ) { return new WP_Error( 'mcp_busy', __( 'Başka bir işlem kaydediliyor. Yeniden deneyin.', 'flx-ai' ), array( 'status' => 409 ) ); }
	try {
		flxai_mcp_refresh_options();
		$state = flxai_admin_mcp_snapshot();
		if ( $state['legacy'] ) { return new WP_Error( 'mcp_legacy', __( 'Önce eski Flux SEO eklentisini güncelleyin.', 'flx-ai' ), array( 'status' => 409 ) ); }
		if ( ! is_string( $body['revision'] ?? null ) || ! hash_equals( $state['revision'], $body['revision'] ) ) { return new WP_Error( 'mcp_stale', __( 'MCP ayarları değişti. Yenileyip tekrar deneyin.', 'flx-ai' ), array( 'status' => 409 ) ); }
		$invalid = new WP_Error( 'mcp_input', __( 'Geçersiz MCP değişikliği.', 'flx-ai' ), array( 'status' => 400 ) );
		$action = $body['action'] ?? null; $created = null; $keys = flxai_mcp_keys();
		if ( 'toggle' === $action ) {
			if ( array_diff( array_keys( $body ), array( 'action', 'revision', 'enabled' ) ) || ! is_bool( $body['enabled'] ?? null ) ) { return $invalid; }
			flxai_update_settings( array( 'mcp_enabled' => $body['enabled'] ? 1 : 0 ) );
		} elseif ( 'create' === $action ) {
			if ( array_diff( array_keys( $body ), array( 'action', 'revision', 'name', 'scope', 'tools' ) ) || ! is_string( $body['name'] ?? null ) || ! in_array( $body['scope'] ?? null, array( 'selected', 'all' ), true ) || ! is_array( $body['tools'] ?? null ) ) { return $invalid; }
			if ( ! current_user_can( 'edit_posts' ) ) { return new WP_Error( 'mcp_cap', __( 'Anahtar sahibi içerik düzenleme yetkisine sahip olmalıdır.', 'flx-ai' ), array( 'status' => 403 ) ); }
			$names = array(); $registered = array_column( $state['tools'], null, 'name' );
			foreach ( $body['tools'] as $name ) {
				if ( ! is_string( $name ) ) { return $invalid; }
				$name = flxai_tool_resolve( $name ); if ( ! isset( $registered[ $name ] ) ) { return $invalid; } $names[ $name ] = true;
			}
			if ( 'selected' === $body['scope'] && ! $names || 'all' === $body['scope'] && $names ) { return $invalid; }
			$secret = 'flxmcp_' . wp_generate_password( 40, false, false ); $id = wp_generate_uuid4();
			$name = sanitize_text_field( $body['name'] );
			$keys[ $id ] = array( 'name' => '' !== $name ? $name : __( 'Yapay zekâ', 'flx-ai' ), 'hash' => hash( 'sha256', $secret ), 'user' => get_current_user_id(), 'created' => time(), 'last_used' => 0, 'hint' => substr( $secret, -4 ) );
			if ( 'selected' === $body['scope'] ) { $keys[ $id ]['tools'] = array_keys( $names ); }
			update_option( 'flxai_mcp_keys', $keys, false );
			$created = array( 'id' => $id, 'secret' => $secret );
		} elseif ( 'revoke' === $action ) {
			if ( array_diff( array_keys( $body ), array( 'action', 'revision', 'id' ) ) || ! is_string( $body['id'] ?? null ) ) { return $invalid; }
			if ( ! isset( $keys[ $body['id'] ] ) ) { return new WP_Error( 'mcp_missing', __( 'Anahtar bulunamadı.', 'flx-ai' ), array( 'status' => 404 ) ); }
			$old = $keys[ $body['id'] ];
			$pending = get_transient( 'flxai_mcp_new_key_' . (int) $old['user'] );
			if ( is_string( $pending ) && hash_equals( (string) $old['hash'], hash( 'sha256', $pending ) ) ) { delete_transient( 'flxai_mcp_new_key_' . (int) $old['user'] ); }
			unset( $keys[ $body['id'] ] ); update_option( 'flxai_mcp_keys', $keys, false );
		} else { return $invalid; }
		$result = array( 'state' => flxai_admin_mcp_snapshot() );
		if ( $created ) { $result['created'] = $created; }
		return $result;
	} finally { $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock ) ); }
}

function flxai_admin_mcp_post( WP_REST_Request $request ) {
	$body = $request->get_json_params();
	if ( ! is_array( $body ) ) { return new WP_Error( 'mcp_input', __( 'Geçersiz istek.', 'flx-ai' ), array( 'status' => 400 ) ); }
	$result = flxai_admin_mcp_update( $body );
	return is_wp_error( $result ) ? $result : new WP_REST_Response( $result, 200, array( 'Cache-Control' => 'no-store, private', 'Pragma' => 'no-cache' ) );
}
