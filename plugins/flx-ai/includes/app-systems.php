<?php
/** Connected-system administration shared by app renderers and WordPress. */
defined( 'ABSPATH' ) || exit;

/** Only declared field metadata is sent; plugin callbacks and provider settings stay on the server. */
function flxai_admin_system_fields( $source ) {
	$registry = function_exists( 'flx_ai_registry' ) ? flx_ai_registry() : array();
	$out = array();
	foreach ( (array) ( $registry['settings'][ $source ] ?? array() ) as $key => $field ) {
		$type = (string) ( $field['type'] ?? 'text' );
		$supported = in_array( $type, array( 'toggle', 'text', 'textarea', 'number', 'select', 'model' ), true );
		$row = array( 'key' => (string) $key, 'type' => $type, 'label' => (string) ( $field['label'] ?? $key ), 'help' => (string) ( $field['help'] ?? '' ), 'supported' => $supported );
		if ( $supported ) {
			$row['value'] = flx_ai_get( $source, $key );
			$row['options'] = array();
			foreach ( (array) ( $field['options'] ?? array() ) as $value => $label ) { $row['options'][] = array( 'value' => (string) $value, 'label' => (string) $label ); }
			foreach ( array( 'min', 'max' ) as $bound ) { if ( isset( $field[ $bound ] ) && is_numeric( $field[ $bound ] ) ) { $row[ $bound ] = $field[ $bound ] + 0; } }
		}
		$out[] = $row;
	}
	return $out;
}

function flxai_admin_system_detail( $source ) {
	$system = null;
	foreach ( flxai_systems() as $row ) { if ( $row['source'] === $source ) { $system = $row; break; } }
	if ( ! $system ) { return new WP_Error( 'flxai_system_missing', __( 'Sistem bulunamadı.', 'flx-ai' ), array( 'status' => 404 ) ); }
	$registry = function_exists( 'flx_ai_registry' ) ? flx_ai_registry() : array();
	$system['description'] = (string) ( $registry['plugins'][ $source ]['description'] ?? '' );
	$system['fields'] = flxai_admin_system_fields( $source );
	$system['configured_model'] = (string) ( ( (array) flxai_setting( 'source_models', array() ) )[ $source ] ?? '' );
	$system['default_model'] = (string) flxai_model_for( '' );
	$tools = array_values( array_filter( flxai_tools_rows(), static function ( $tool ) use ( $source ) { return $tool['source'] === $source && ! $tool['dupe']; } ) );
	$system['tool_count'] = count( $tools );
	$system['tools_enabled'] = count( array_filter( $tools, static function ( $tool ) { return ! $tool['off']; } ) );
	$system['sdk_version'] = defined( 'FLX_AI_SDK_VERSION' ) ? FLX_AI_SDK_VERSION : '';
	// Usage changes do not invalidate an unsaved form. Definitions, values and relevant model defaults do.
	$system['revision'] = hash_hmac( 'sha256', wp_json_encode( array( $source, $system['on'], $system['configured_model'], $system['default_model'], $system['fields'] ) ), wp_salt( 'nonce' ) );
	return $system;
}

function flxai_admin_systems_get( WP_REST_Request $request ) {
	$q = $request->get_param( 'q' ) ?? '';
	$page = $request->get_param( 'page' ) ?? 1; $per = $request->get_param( 'per_page' ) ?? 30;
	if ( ! is_string( $q ) || false === filter_var( $page, FILTER_VALIDATE_INT ) || false === filter_var( $per, FILTER_VALIDATE_INT ) || $page < 1 || $per < 1 || $per > 100 ) {
		return new WP_Error( 'flxai_filter', __( 'Geçersiz süzgeç.', 'flx-ai' ), array( 'status' => 400 ) );
	}
	$fold = static function ( $text ) { return function_exists( 'mb_strtolower' ) ? mb_strtolower( remove_accents( $text ), 'UTF-8' ) : strtolower( remove_accents( $text ) ); };
	$all = flxai_systems();
	$rows = array_values( array_filter( $all, static function ( $row ) use ( $fold, $q ) { return '' === trim( $q ) || false !== strpos( $fold( $row['source'] . ' ' . $row['label'] ), $fold( trim( $q ) ) ); } ) );
	usort( $rows, static function ( $a, $b ) { return array( $a['label'], $a['source'] ) <=> array( $b['label'], $b['source'] ); } );
	return array( 'revision' => flxai_admin_systems_revision( $all ), 'items' => array_slice( $rows, ( (int) $page - 1 ) * (int) $per, (int) $per ), 'total' => count( $rows ), 'page' => (int) $page, 'pages' => max( 1, (int) ceil( count( $rows ) / $per ) ) );
}

function flxai_admin_systems_revision( array $rows ) {
	$states = array_column( $rows, 'on', 'source' ); ksort( $states );
	return hash_hmac( 'sha256', wp_json_encode( $states ), wp_salt( 'nonce' ) );
}

/** WordPress list switches use the same lock as per-system forms and native tool administration. */
function flxai_admin_systems_toggle( array $body ) {
	if ( ! flxai_can_manage() ) { return new WP_Error( 'flxai_forbidden', __( 'Yetkiniz yok.', 'flx-ai' ), array( 'status' => 403 ) ); }
	global $wpdb; $lock = flxai_admin_tools_lock_name();
	if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $lock ) ) ) { return new WP_Error( 'flxai_busy', __( 'Başka bir işlem kaydediliyor. Yeniden deneyin.', 'flx-ai' ), array( 'status' => 409 ) ); }
	try {
		wp_cache_delete( 'alloptions', 'options' ); wp_cache_delete( 'flxai_settings', 'options' ); $GLOBALS['flxai_settings_cache'] = null;
		$rows = flxai_systems();
		if ( ! is_string( $body['revision'] ?? null ) || ! hash_equals( flxai_admin_systems_revision( $rows ), $body['revision'] ) ) { return new WP_Error( 'flxai_stale', __( 'Sistem ayarları değişti. Yenileyip tekrar deneyin.', 'flx-ai' ), array( 'status' => 409 ) ); }
		if ( ! is_array( $body['changes'] ?? null ) || array_diff( array_keys( $body ), array( 'revision', 'changes' ) ) ) { return new WP_Error( 'flxai_system_field', __( 'Geçersiz sistem ayarı.', 'flx-ai' ), array( 'status' => 400 ) ); }
		$known = array_column( $rows, 'source' );
		foreach ( $body['changes'] as $source => $enabled ) { if ( ! in_array( $source, $known, true ) || ! is_bool( $enabled ) ) { return new WP_Error( 'flxai_system_field', __( 'Geçersiz sistem ayarı.', 'flx-ai' ), array( 'status' => 400 ) ); } }
		$off = array_fill_keys( (array) flxai_setting( 'sources_off', array() ), true );
		foreach ( $body['changes'] as $source => $enabled ) { if ( $enabled ) { unset( $off[ $source ] ); } else { $off[ $source ] = true; } }
		flxai_update_settings( array( 'sources_off' => array_keys( $off ) ) );
		return array( 'ok' => true );
	} finally { $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock ) ); }
}

/** Validate the entire form before writing either option; source-absent preferences are retained. */
function flxai_admin_system_update( $source, array $body ) {
	if ( ! flxai_can_manage() ) { return new WP_Error( 'flxai_forbidden', __( 'Yetkiniz yok.', 'flx-ai' ), array( 'status' => 403 ) ); }
	global $wpdb;
	// Share the lock with tool administration because both update flxai_settings.
	$lock = flxai_admin_tools_lock_name();
	if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $lock ) ) ) { return new WP_Error( 'flxai_busy', __( 'Başka bir işlem kaydediliyor. Yeniden deneyin.', 'flx-ai' ), array( 'status' => 409 ) ); }
	try {
		wp_cache_delete( 'alloptions', 'options' ); wp_cache_delete( 'flxai_settings', 'options' ); $GLOBALS['flxai_settings_cache'] = null;
		if ( defined( 'FLX_AI_SDK_OPTION' ) ) { wp_cache_delete( FLX_AI_SDK_OPTION, 'options' ); }
		$current = flxai_admin_system_detail( $source ); if ( is_wp_error( $current ) ) { return $current; }
		if ( ! is_string( $body['revision'] ?? null ) || ! hash_equals( $current['revision'], $body['revision'] ) ) { return new WP_Error( 'flxai_stale', __( 'Sistem ayarları değişti. Yenileyip tekrar deneyin.', 'flx-ai' ), array( 'status' => 409 ) ); }
		$invalid = new WP_Error( 'flxai_system_field', __( 'Geçersiz sistem ayarı.', 'flx-ai' ), array( 'status' => 400 ) );
		if ( array_diff( array_keys( $body ), array( 'revision', 'enabled', 'model', 'values' ) ) || ! is_bool( $body['enabled'] ?? null ) || ! is_string( $body['model'] ?? null ) || ! is_array( $body['values'] ?? null ) ) { return $invalid; }
		$fields = array_column( $current['fields'], null, 'key' );
		$values = array();
		foreach ( $body['values'] as $key => $value ) {
			if ( ! isset( $fields[ $key ] ) || ! $fields[ $key ]['supported'] ) { return $invalid; }
			$field = $fields[ $key ];
			switch ( $field['type'] ) {
				case 'toggle': if ( ! is_bool( $value ) ) { return $invalid; } break;
				case 'number':
					if ( ! is_numeric( $value ) || ! is_finite( (float) $value ) ) { return $invalid; }
					$value += 0; break;
				case 'select':
					if ( ! is_string( $value ) || ! in_array( $value, array_column( $field['options'], 'value' ), true ) ) { return $invalid; } break;
				default: if ( ! is_string( $value ) ) { return $invalid; }
			}
			$values[ $key ] = $value;
		}
		$off = array_values( array_diff( (array) flxai_setting( 'sources_off', array() ), array( $source ) ) );
		if ( ! $body['enabled'] ) { $off[] = $source; }
		$models = (array) flxai_setting( 'source_models', array() );
		$model = sanitize_text_field( $body['model'] );
		if ( '' === $model ) { unset( $models[ $source ] ); } else { $models[ $source ] = $model; }
		if ( $values ) { flx_ai_set( $source, $values ); }
		flxai_update_settings( array( 'sources_off' => array_values( array_unique( $off ) ), 'source_models' => $models ) );
		return flxai_admin_system_detail( $source );
	} finally { $wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock ) ); }
}

function flxai_admin_system_get( WP_REST_Request $request ) { return flxai_admin_system_detail( (string) $request['source'] ); }
function flxai_admin_system_post( WP_REST_Request $request ) {
	$body = $request->get_json_params();
	if ( ! is_array( $body ) ) { return new WP_Error( 'flxai_body', __( 'Geçersiz istek.', 'flx-ai' ), array( 'status' => 400 ) ); }
	return flxai_admin_system_update( (string) $request['source'], $body );
}
