<?php
/** Shared AI administration contracts for WordPress and the native apps. */
defined( 'ABSPATH' ) || exit;

/**
 * Ekrandaki satırlar: açık/kapalı tüm araçlar + çakışan (kullanılmayan) ikinci tanımlar.
 *
 * @return array[] name, title, description, source, label, readonly, approval, cap, mcp, chat, off, aliases,
 *                 dupe (bu satır çakışan ikinci tanım mı), rivals (aynı adı kaydeden diğer kaynaklar), prefixed
 */
function flxai_tools_rows() {
	$chat  = flxai_chat_registry( true );
	$mcp   = flxai_mcp_registry();
	$off   = flxai_tools_off();
	$dupes = $chat['dupes'];
	$rows  = array();
	$names = array_unique( array_merge( array_keys( $mcp['tools'] ), array_keys( $chat['tools'] ) ) );
	$row   = function ( $name, array $t, $dupe, $rivals ) use ( $chat, $mcp, $off ) {
		$src = '' !== (string) ( $t['source'] ?? '' ) ? (string) $t['source'] : flxai_mcp_tool_source( $t );
		$inf = flxai_source_info( $src );
		return array(
			'name'        => (string) $name,
			'title'       => (string) ( $t['title'] ?? $name ),
			'description' => (string) ( $t['description'] ?? '' ),
			'source'      => $src,
			'label'       => $inf['label'],
			'readonly'    => ! empty( $t['readonly'] ),
			'approval'    => flxai_tool_needs_approval( $t + array( 'readonly' => false ) ),
			'cap'         => (string) ( $t['cap'] ?? 'edit_posts' ),
			'mcp'         => ! $dupe && isset( $mcp['tools'][ $name ] ),
			'chat'        => ! $dupe && isset( $chat['tools'][ $name ] ),
			'off'         => ! $dupe && in_array( $name, $off, true ),
			'aliases'     => array_values( array_map( 'strval', (array) ( $t['aliases'] ?? array() ) ) ),
			'dupe'        => $dupe,
			'rivals'      => $rivals,
			'prefixed'    => flxai_tool_prefixed( $name, $src ),
		);
	};
	foreach ( $names as $name ) {
		$t      = $chat['tools'][ $name ] ?? $mcp['tools'][ $name ];
		$rivals = array_keys( (array) ( $dupes[ $name ] ?? array() ) );
		$rows[] = $row( $name, $t, false, $rivals );
		foreach ( (array) ( $dupes[ $name ] ?? array() ) as $src => $d ) {
			$d['source'] = $src;
			$rows[]      = $row( $name, $d, true, array( (string) ( $t['source'] ?? '' ) ) );
		}
	}
	usort(
		$rows,
		function ( $a, $b ) {
			return array( $a['label'], $a['name'], $a['dupe'] ) <=> array( $b['label'], $b['name'], $b['dupe'] );
		}
	);
	return $rows;
}

/** Version only the editable controls and registered definitions, never provider credentials. */
function flxai_admin_tools_revision( array $rows ) {
	$definitions = array();
	foreach ( $rows as $row ) {
		unset( $row['id'], $row['usage'] );
		$definitions[ $row['name'] . '|' . $row['source'] ] = $row;
	}
	ksort( $definitions );
	$off = flxai_tools_off(); sort( $off );
	$picks = (array) flxai_setting( 'tool_pick', array() ); ksort( $picks );
	return hash_hmac( 'sha256', wp_json_encode( array( $definitions, $off, $picks ) ), wp_salt( 'nonce' ) );
}

function flxai_admin_tools_filter( array $input ) {
	$out = array();
	foreach ( array( 'q', 'source', 'kind', 'state' ) as $key ) {
		if ( isset( $input[ $key ] ) && ! is_string( $input[ $key ] ) ) {
			return new WP_Error( 'flxai_filter', __( 'Geçersiz süzgeç.', 'flx-ai' ), array( 'status' => 400 ) );
		}
		$out[ $key ] = (string) ( $input[ $key ] ?? '' );
	}
	if ( ! in_array( $out['kind'], array( '', 'read', 'write' ), true ) || ! in_array( $out['state'], array( '', 'on', 'off', 'conflict', 'noprefix' ), true ) ) {
		return new WP_Error( 'flxai_filter', __( 'Geçersiz süzgeç.', 'flx-ai' ), array( 'status' => 400 ) );
	}
	$out['q'] = trim( $out['q'] );
	return $out;
}

function flxai_admin_tools_matches( array $row, array $filter ) {
	if ( '' !== $filter['source'] && $row['source'] !== $filter['source'] ) { return false; }
	if ( 'read' === $filter['kind'] && ! $row['readonly'] || 'write' === $filter['kind'] && $row['readonly'] ) { return false; }
	if ( 'on' === $filter['state'] && ( $row['dupe'] || $row['off'] ) || 'off' === $filter['state'] && ( $row['dupe'] || ! $row['off'] ) ) { return false; }
	if ( 'conflict' === $filter['state'] && ! $row['dupe'] && ! $row['rivals'] || 'noprefix' === $filter['state'] && $row['prefixed'] ) { return false; }
	if ( '' !== $filter['q'] ) {
		$fold = static function ( $value ) { $value = remove_accents( $value ); return function_exists( 'mb_strtolower' ) ? mb_strtolower( $value, 'UTF-8' ) : strtolower( $value ); };
		$text = implode( ' ', array( $row['name'], $row['title'], $row['description'], $row['source'], $row['label'], implode( ' ', $row['aliases'] ) ) );
		if ( false === strpos( $fold( $text ), $fold( $filter['q'] ) ) ) { return false; }
	}
	return true;
}

/** Counts include all callers of a tool name; the log does not identify historical rival definitions. */
function flxai_admin_tool_usage() {
	global $wpdb;
	$from = ( new DateTimeImmutable( 'today', wp_timezone() ) )->modify( '-29 days' )->getTimestamp();
	$where = flxai_report_where( $from, time() + 1 );
	$table = flxai_table( 'log' );
	$stats = $wpdb->get_results( "SELECT tool AS k, COUNT(*) AS n, SUM(ms) AS total_ms, SUM(ok=0) AS errors FROM {$table} WHERE {$where} AND kind='tool' GROUP BY tool", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL
	$out = array();
	foreach ( (array) $stats as $row ) {
		$name = flxai_tool_resolve( (string) $row['k'] );
		if ( ! isset( $out[ $name ] ) ) { $out[ $name ] = array( 'n' => 0, 'total_ms' => 0, 'errors' => 0 ); }
		$out[ $name ]['n'] += (int) $row['n'];
		$out[ $name ]['total_ms'] += (int) $row['total_ms'];
		$out[ $name ]['errors'] += (int) $row['errors'];
	}
	foreach ( $out as &$row ) { $row['avg_ms'] = $row['n'] ? $row['total_ms'] / $row['n'] : 0; }
	unset( $row );
	return $out;
}

function flxai_admin_tools_get( WP_REST_Request $request ) {
	$filter = flxai_admin_tools_filter( $request->get_query_params() );
	if ( is_wp_error( $filter ) ) { return $filter; }
	$page = $request->get_param( 'page' ) ?? 1; $per = $request->get_param( 'per_page' ) ?? 30;
	if ( false === filter_var( $page, FILTER_VALIDATE_INT ) || false === filter_var( $per, FILTER_VALIDATE_INT ) || (int) $page < 1 || (int) $per < 1 || (int) $per > 100 ) {
		return new WP_Error( 'flxai_page', __( 'Geçersiz sayfa.', 'flx-ai' ), array( 'status' => 400 ) );
	}
	$rows = flxai_tools_rows(); $usage = flxai_admin_tool_usage();
	$sources = array(); $names = array(); $conflicts = array(); $on = 0; $unprefixed = 0;
	foreach ( $rows as &$row ) {
		$row['id'] = $row['name'] . '|' . $row['source'];
		$row['usage'] = $usage[ $row['name'] ] ?? null;
		$source = $row['source'];
		if ( ! isset( $sources[ $source ] ) ) { $sources[ $source ] = array( 'id' => $source, 'label' => $row['label'], 'total' => 0, 'on' => 0, 'duplicates' => 0 ); }
		if ( $row['dupe'] ) { ++$sources[ $source ]['duplicates']; }
		else {
			$names[ $row['name'] ] = true; ++$sources[ $source ]['total'];
			$on += $row['off'] ? 0 : 1; $sources[ $source ]['on'] += $row['off'] ? 0 : 1;
			$unprefixed += $row['prefixed'] ? 0 : 1;
		}
		if ( $row['dupe'] || $row['rivals'] ) { $conflicts[ $row['name'] ] = true; }
	}
	unset( $row );
	$filtered = array_values( array_filter( $rows, static function ( $row ) use ( $filter ) { return flxai_admin_tools_matches( $row, $filter ); } ) );
	return array(
		'revision' => flxai_admin_tools_revision( $rows ),
		'items' => array_slice( $filtered, ( (int) $page - 1 ) * (int) $per, (int) $per ),
		'total' => count( $filtered ), 'selectable_total' => count( array_filter( $filtered, static function ( $row ) { return ! $row['dupe']; } ) ),
		'page' => (int) $page, 'pages' => max( 1, (int) ceil( count( $filtered ) / (int) $per ) ),
		'sources' => array_values( $sources ),
		'summary' => array( 'tools' => count( $names ), 'on' => $on, 'off' => count( $names ) - $on, 'conflicts' => count( $conflicts ), 'unprefixed' => $unprefixed ),
	);
}

function flxai_admin_tools_lock_name() {
	global $wpdb;
	return 'flx-ai-tools-' . md5( DB_NAME . '|' . $wpdb->prefix );
}

/** Validate the complete change before writing; inactive-plugin disabled names are retained. */
function flxai_admin_tools_update( array $body ) {
	if ( ! flxai_can_manage() ) { return new WP_Error( 'flxai_forbidden', __( 'Yetkiniz yok.', 'flx-ai' ), array( 'status' => 403 ) ); }
	global $wpdb;
	$lock = flxai_admin_tools_lock_name();
	if ( 1 !== (int) $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 0)', $lock ) ) ) {
		return new WP_Error( 'flxai_busy', __( 'Başka bir işlem kaydediliyor. Yeniden deneyin.', 'flx-ai' ), array( 'status' => 409 ) );
	}
	try {
		wp_cache_delete( 'alloptions', 'options' ); wp_cache_delete( 'flxai_settings', 'options' ); $GLOBALS['flxai_settings_cache'] = null;
		$rows = flxai_tools_rows();
		if ( ! is_string( $body['revision'] ?? null ) || ! hash_equals( flxai_admin_tools_revision( $rows ), $body['revision'] ) ) {
			return new WP_Error( 'flxai_stale', __( 'Araç ayarları değişti. Yenileyip tekrar deneyin.', 'flx-ai' ), array( 'status' => 409 ) );
		}
		$invalid = new WP_Error( 'flxai_change', __( 'Geçersiz araç değişikliği.', 'flx-ai' ), array( 'status' => 400 ) );
		if ( array_diff( array_keys( $body ), array( 'revision', 'changes', 'bulk', 'pick' ) ) || ! is_array( $body['changes'] ?? array() ) ) { return $invalid; }
		$active = array(); $definitions = array();
		foreach ( $rows as $row ) { $definitions[ $row['name'] ][ $row['source'] ] = true; if ( ! $row['dupe'] ) { $active[ $row['name'] ] = true; } }
		$changes = $body['changes'] ?? array();
		foreach ( $changes as $name => $enabled ) { if ( ! isset( $active[ $name ] ) || ! is_bool( $enabled ) ) { return $invalid; } }
		if ( isset( $body['bulk'] ) ) {
			$bulk = $body['bulk'];
			if ( ! is_array( $bulk ) || ! is_bool( $bulk['enabled'] ?? null ) || isset( $bulk['names'] ) === isset( $bulk['filter'] ) || array_diff( array_keys( $bulk ), array( 'enabled', 'names', 'filter', 'exclude' ) ) || ! is_array( $bulk['exclude'] ?? array() ) ) { return $invalid; }
			foreach ( $bulk['exclude'] ?? array() as $name ) { if ( ! is_string( $name ) || ! isset( $active[ $name ] ) ) { return $invalid; } }
			if ( isset( $bulk['names'] ) ) {
				if ( ! is_array( $bulk['names'] ) ) { return $invalid; }
				foreach ( $bulk['names'] as $name ) { if ( ! is_string( $name ) || ! isset( $active[ $name ] ) ) { return $invalid; } if ( ! in_array( $name, $bulk['exclude'] ?? array(), true ) ) { $changes[ $name ] = $bulk['enabled']; } }
			} else {
				if ( ! is_array( $bulk['filter'] ) || array_diff( array_keys( $bulk['filter'] ), array( 'q', 'source', 'kind', 'state' ) ) ) { return $invalid; }
				$filter = flxai_admin_tools_filter( $bulk['filter'] ); if ( is_wp_error( $filter ) ) { return $filter; }
				foreach ( $rows as $row ) { if ( ! $row['dupe'] && flxai_admin_tools_matches( $row, $filter ) && ! in_array( $row['name'], $bulk['exclude'] ?? array(), true ) ) { $changes[ $row['name'] ] = $bulk['enabled']; } }
			}
		}
		$picks = (array) flxai_setting( 'tool_pick', array() );
		if ( isset( $body['pick'] ) ) {
			$pick = $body['pick'];
			if ( ! is_array( $pick ) || ! is_string( $pick['name'] ?? null ) || ! is_string( $pick['source'] ?? null ) || ! isset( $definitions[ $pick['name'] ][ $pick['source'] ] ) || array_diff( array_keys( $pick ), array( 'name', 'source' ) ) ) { return $invalid; }
			$picks[ $pick['name'] ] = $pick['source'];
		}
		$off = array_fill_keys( flxai_tools_off(), true );
		foreach ( $changes as $name => $enabled ) { if ( $enabled ) { unset( $off[ $name ] ); } else { $off[ $name ] = true; } }
		flxai_update_settings( array( 'tools_off' => array_keys( $off ), 'tool_pick' => $picks ) );
		return array( 'ok' => true, 'changed' => count( $changes ) + ( isset( $body['pick'] ) ? 1 : 0 ) );
	} finally {
		$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', $lock ) );
	}
}

function flxai_admin_tools_post( WP_REST_Request $request ) {
	$body = $request->get_json_params();
	if ( ! is_array( $body ) ) { return new WP_Error( 'flxai_body', __( 'Geçersiz istek.', 'flx-ai' ), array( 'status' => 400 ) ); }
	return flxai_admin_tools_update( $body );
}

