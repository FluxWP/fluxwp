<?php
/** Shared language settings write path and native administration contract. */
defined( 'ABSPATH' ) || exit;

function flxl_prepare_settings( array $in ) {
	foreach ( array( 'langs', 'texts', 'post_types' ) as $key ) {
		if ( isset( $in[ $key ] ) && ! is_array( $in[ $key ] ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz ayar biçimi.', 'flx-lang' ), array( 'status' => 400 ) ); }
	}
	foreach ( (array) ( $in['langs'] ?? array() ) as $language ) {
		if ( ! is_array( $language ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz dil bilgisi.', 'flx-lang' ), array( 'status' => 400 ) ); }
		foreach ( array( 'name', 'locale', 'flag' ) as $key ) { if ( isset( $language[ $key ] ) && ! is_string( $language[ $key ] ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz dil bilgisi.', 'flx-lang' ), array( 'status' => 400 ) ); } }
		foreach ( array( 'active', 'remove' ) as $key ) { if ( isset( $language[ $key ] ) && ! in_array( $language[ $key ], array( 0, 1, '0', '1', false, true ), true ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz dil durumu.', 'flx-lang' ), array( 'status' => 400 ) ); } }
	}
	if ( isset( $in['fallback'] ) && ! in_array( $in['fallback'], array( 0, 1, '0', '1', false, true ), true ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz ayar biçimi.', 'flx-lang' ), array( 'status' => 400 ) ); }
	foreach ( (array) ( $in['texts'] ?? array() ) as $values ) {
		if ( ! is_array( $values ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz çeviri bilgisi.', 'flx-lang' ), array( 'status' => 400 ) ); }
		foreach ( $values as $value ) { if ( ! is_string( $value ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz çeviri bilgisi.', 'flx-lang' ), array( 'status' => 400 ) ); } }
	}
	foreach ( (array) ( $in['post_types'] ?? array() ) as $value ) { if ( ! is_string( $value ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz içerik türü.', 'flx-lang' ), array( 'status' => 400 ) ); } }
	foreach ( array( 'default', 'add_lang', 'suggest', 'suggest_to', 'switcher', 'switcher_place', 'home_countries' ) as $key ) { if ( isset( $in[ $key ] ) && ! is_string( $in[ $key ] ) ) { return new WP_Error( 'flxl_invalid', __( 'Geçersiz ayar biçimi.', 'flx-lang' ), array( 'status' => 400 ) ); } }
	$old = flxl_settings();
	$s   = $old;
	$cat = flxl_catalog();

	$langs = array();
	foreach ( (array) ( $in['langs'] ?? array() ) as $code => $l ) {
		$code = sanitize_key( $code );
		if ( ! preg_match( '/^[a-z]{2,3}$/', $code ) || ! empty( $l['remove'] ) ) {
			continue;
		}
		$langs[ $code ] = array(
			'name'   => sanitize_text_field( $l['name'] ?? $code ),
			'locale' => preg_replace( '/[^A-Za-z_]/', '', (string) ( $l['locale'] ?? '' ) ),
			'flag'   => sanitize_text_field( $l['flag'] ?? '' ),
			'active' => empty( $l['active'] ) ? 0 : 1,
		);
	}
	$add = sanitize_key( $in['add_lang'] ?? '' );
	if ( $add && isset( $cat[ $add ] ) && ! isset( $langs[ $add ] ) ) {
		$langs[ $add ] = $cat[ $add ] + array( 'active' => 0 ); // Pasif eklenir: önce içerik hazırlanır.
	}
	if ( ! $langs ) { $langs = $old['languages']; }
	$def = sanitize_key( $in['default'] ?? $old['default'] );
	if ( ! isset( $langs[ $def ] ) ) {
		$def = isset( $langs[ $old['default'] ] ) ? $old['default'] : (string) key( $langs );
	}
	if ( isset( $langs[ $def ] ) ) {
		$langs[ $def ]['active'] = 1;
	}
	$s['languages'] = $langs ? $langs : $old['languages'];
	$s['default']   = $def;

	$s['post_types'] = array_values( array_filter( array_map( 'sanitize_key', (array) ( $in['post_types'] ?? array() ) ), 'post_type_exists' ) );
	$s['fallback']   = empty( $in['fallback'] ) ? 0 : 1;
	$s['suggest']    = in_array( $in['suggest'] ?? '', array( 'off', 'banner', 'redirect' ), true ) ? $in['suggest'] : 'redirect';
	$others = array_diff( array_keys( $s['languages'] ), array( $def ) );
	$s['suggest_to'] = isset( $s['languages'][ sanitize_key( $in['suggest_to'] ?? '' ) ] ) ? sanitize_key( $in['suggest_to'] ) : ( $others ? (string) reset( $others ) : $def );
	$s['switcher']   = in_array( $in['switcher'] ?? '', array( 'code', 'name', 'flag' ), true ) ? $in['switcher'] : 'code';
	$s['switcher_place'] = in_array( $in['switcher_place'] ?? '', array( 'footer', 'header', 'both' ), true ) ? $in['switcher_place'] : 'footer';
	$countries       = preg_split( '/[\s,;]+/', strtoupper( (string) ( $in['home_countries'] ?? '' ) ), -1, PREG_SPLIT_NO_EMPTY );
	$s['home_countries'] = array_values( array_unique( array_filter( $countries, function ( $c ) {
		return (bool) preg_match( '/^[A-Z]{2}$/', $c );
	} ) ) );

	$fields = flxl_text_fields();
	$texts  = array();
	foreach ( (array) ( $in['texts'] ?? array() ) as $code => $vals ) {
		$code = sanitize_key( $code );
		if ( ! isset( $s['languages'][ $code ] ) || $code === $def ) {
			continue;
		}
		foreach ( (array) $vals as $k => $v ) {
			if ( isset( $fields[ $k ] ) && '' !== trim( (string) $v ) ) {
				$texts[ $code ][ $k ] = empty( $fields[ $k ]['textarea'] ) ? sanitize_text_field( $v ) : sanitize_textarea_field( $v );
			}
		}
	}
	$s['texts'] = $texts;
	return $s;
}

function flxl_save_settings( array $in ) {
	$settings = flxl_prepare_settings( $in );
	if ( is_wp_error( $settings ) ) { return $settings; }
	update_option( 'flxl_settings', $settings, true );
	flxl_settings( true );
	flxl_ensure_terms();
	flxl_index_flush();
	return $settings;
}

function flxl_native_configuration() {
	$settings = array_intersect_key( flxl_settings(), flxl_default_settings() );
	$types = array();
	foreach ( get_post_types( array( 'public' => true ), 'objects' ) as $type ) { $types[] = array( 'id' => $type->name, 'label' => $type->labels->singular_name ); }
	$fields = array();
	foreach ( flxl_text_fields() as $id => $field ) {
		$base = flxl_raw( function () use ( $field ) { $value = get_option( $field['option'] ); return empty( $field['key'] ) ? (string) $value : (string) ( is_array( $value ) ? ( $value[ $field['key'] ] ?? '' ) : '' ); } );
		$fields[] = array( 'id' => $id, 'label' => $field['label'], 'multiline' => ! empty( $field['textarea'] ), 'base' => $base );
	}
	return array( 'settings' => $settings, 'catalog' => flxl_catalog(), 'post_types' => $types, 'text_fields' => $fields, 'version' => hash( 'sha256', wp_json_encode( $settings ) ) );
}

function flxl_native_save( WP_REST_Request $request ) {
	$in = (array) $request->get_json_params();
	$current = flxl_native_configuration();
	if ( ! isset( $in['version'] ) || ! is_string( $in['version'] ) || ! hash_equals( $current['version'], $in['version'] ) ) { return new WP_Error( 'flxl_conflict', __( 'Ayarlar başka bir yerde değişti. Yenileyip tekrar deneyin.', 'flx-lang' ), array( 'status' => 409 ) ); }
	foreach ( array( 'langs', 'default', 'post_types', 'fallback', 'suggest', 'suggest_to', 'switcher', 'switcher_place', 'home_countries', 'texts' ) as $key ) {
		if ( ! array_key_exists( $key, $in ) ) { return new WP_Error( 'flxl_invalid', __( 'Dil ayarları eksik gönderildi.', 'flx-lang' ), array( 'status' => 400 ) ); }
	}
	$result = flxl_save_settings( $in );
	return is_wp_error( $result ) ? $result : flxl_native_configuration();
}

add_action( 'rest_api_init', function () {
	$permission = function () { return current_user_can( 'manage_options' ); };
	register_rest_route( 'flx-lang/v1', '/configuration', array( 'methods' => 'GET', 'callback' => 'flxl_native_configuration', 'permission_callback' => $permission ) );
	register_rest_route( 'flx-lang/v1', '/configuration', array( 'methods' => 'POST', 'callback' => 'flxl_native_save', 'permission_callback' => $permission ) );
} );

add_filter( 'rest_post_dispatch', function ( $response, $server, $request ) {
	if ( 0 === strpos( $request->get_route(), '/flx-lang/v1/configuration' ) && $response instanceof WP_REST_Response ) {
		$response->header( 'Cache-Control', 'private, no-store, max-age=0' );
		$response->header( 'CDN-Cache-Control', 'no-store' );
		$response->header( 'X-LiteSpeed-Cache-Control', 'no-cache' );
	}
	return $response;
}, 10, 3 );
