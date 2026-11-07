<?php
/**
 * Kullanım raporları ve faturalandırma dökümleri (flxai_log üzerinden).
 *
 * @package FLX_AI
 */

defined( 'ABSPATH' ) || exit;

/** Site saat dilimi farkı (sn). */
function flxai_tz_offset() {
	return (int) wp_timezone()->getOffset( new DateTime( 'now' ) );
}

/** WHERE parçası: zaman aralığı + isteğe bağlı kaynak. */
function flxai_report_where( $from, $to, $source = '' ) {
	global $wpdb;
	$w = $wpdb->prepare( 'ts >= %d AND ts < %d', (int) $from, (int) $to );
	if ( '' !== $source ) {
		$w .= $wpdb->prepare( ' AND source = %s', $source );
	}
	return $w;
}

/** Local calendar-day SQL without depending on the database timezone tables. */
function flxai_report_day_sql( $from, $to ) {
	$tz      = wp_timezone();
	$initial = $tz->getOffset( new DateTimeImmutable( '@' . (int) $from ) );
	$cases   = array();
	foreach ( array_reverse( (array) $tz->getTransitions( $from, $to ) ) as $transition ) {
		if ( (int) $transition['ts'] > $from ) {
			$cases[] = 'WHEN ts >= ' . (int) $transition['ts'] . ' THEN ' . (int) $transition['offset'];
		}
	}
	$offset = $cases ? 'CASE ' . implode( ' ', $cases ) . ' ELSE ' . (int) $initial . ' END' : (string) (int) $initial;
	return 'FLOOR((ts + (' . $offset . ')) / 86400)';
}

/**
 * Son N günün raporu.
 *
 * @return array totals, daily, by_source, by_model, by_tool, by_purpose
 */
function flxai_report( $days = 30, $source = '', $from = 0, $to = 0 ) {
	global $wpdb;
	$t   = flxai_table( 'log' );
	if ( ! $from ) {
		$to     = time() + 1;
		$from   = ( new DateTimeImmutable( 'today', wp_timezone() ) )->modify( '-' . ( max( 1, (int) $days ) - 1 ) . ' days' )->getTimestamp();
	}
	$w       = flxai_report_where( $from, $to, $source );
	$day_sql = flxai_report_day_sql( $from, $to );

	$tot = $wpdb->get_row(
		"SELECT
			SUM(kind='model') AS calls, SUM(kind='tool') AS tools,
			SUM(in_tok) AS in_tok, SUM(out_tok) AS out_tok, SUM(cache_read) AS cr, SUM(cache_write) AS cw,
			SUM(cost) AS cost, SUM(full_cost) AS full_cost,
			SUM(CASE WHEN kind='model' THEN ms ELSE 0 END) AS model_ms, SUM(CASE WHEN kind='tool' THEN ms ELSE 0 END) AS tool_ms,
			SUM(ok=0) AS errors
		FROM {$t} WHERE {$w}", // phpcs:ignore
		ARRAY_A
	);
	$totals = array();
	foreach ( (array) $tot as $k => $v ) {
		$totals[ $k ] = in_array( $k, array( 'cost', 'full_cost' ), true ) ? (float) $v : (int) $v;
	}
	$totals['saved'] = max( 0, ( $totals['full_cost'] ?? 0 ) - ( $totals['cost'] ?? 0 ) );

	$rows  = $wpdb->get_results(
			"SELECT {$day_sql} AS d,
				SUM(cost) AS cost, SUM(in_tok) AS in_tok, SUM(out_tok) AS out_tok, SUM(cache_read) AS cr,
				SUM(CASE WHEN kind='model' THEN ms ELSE 0 END) AS model_ms, SUM(CASE WHEN kind='tool' THEN ms ELSE 0 END) AS tool_ms,
				SUM(kind='model') AS calls, SUM(kind='tool') AS tools, SUM(ok=0) AS errors
			FROM {$t} WHERE {$w} GROUP BY d ORDER BY d", // phpcs:ignore
		ARRAY_A
	);
	$by_d  = array();
	foreach ( (array) $rows as $r ) {
		$by_d[ (int) $r['d'] ] = $r;
	}
	$daily = array();
	$utc   = new DateTimeZone( 'UTC' );
	$d0    = (int) floor( ( new DateTimeImmutable( wp_date( 'Y-m-d', $from ), $utc ) )->getTimestamp() / 86400 );
	$d1    = (int) floor( ( new DateTimeImmutable( wp_date( 'Y-m-d', $to - 1 ), $utc ) )->getTimestamp() / 86400 );
	for ( $d = $d0; $d <= $d1; $d++ ) {
		$r       = $by_d[ $d ] ?? array();
		$daily[] = array(
			'date'     => gmdate( 'Y-m-d', $d * 86400 ),
			'cost'     => (float) ( $r['cost'] ?? 0 ),
			'in'       => (int) ( $r['in_tok'] ?? 0 ),
			'out'      => (int) ( $r['out_tok'] ?? 0 ),
			'cr'       => (int) ( $r['cr'] ?? 0 ),
			'model_ms' => (int) ( $r['model_ms'] ?? 0 ),
			'tool_ms'  => (int) ( $r['tool_ms'] ?? 0 ),
			'calls'    => (int) ( $r['calls'] ?? 0 ),
			'tools'    => (int) ( $r['tools'] ?? 0 ),
			'errors'   => (int) ( $r['errors'] ?? 0 ),
		);
	}

	$group = function ( $col, $extra_where = '' ) use ( $wpdb, $t, $w ) {
		return (array) $wpdb->get_results(
			"SELECT {$col} AS k, SUM(kind='model') AS calls, SUM(kind='tool') AS tools, SUM(cost) AS cost, SUM(full_cost) AS full_cost,
				SUM(in_tok) AS in_tok, SUM(out_tok) AS out_tok, SUM(cache_read) AS cr,
				SUM(CASE WHEN kind='model' THEN ms ELSE 0 END) AS model_ms, SUM(CASE WHEN kind='tool' THEN ms ELSE 0 END) AS tool_ms,
				SUM(ok=0) AS errors
			FROM {$t} WHERE {$w} {$extra_where} GROUP BY {$col} ORDER BY cost DESC, calls DESC LIMIT 50", // phpcs:ignore
			ARRAY_A
		);
	};
	$by_source = array();
	foreach ( $group( 'source' ) as $r ) {
		$r['label']  = flxai_source_label( $r['k'] );
		$by_source[] = $r;
	}
	$by_model = array();
	foreach ( $group( 'model', "AND kind='model'" ) as $r ) {
		$r['label'] = flxai_model_label( $r['k'] );
		$by_model[] = $r;
	}
	$by_purpose = $group( "CONCAT(source, '|', purpose)", "AND kind='model'" );
	foreach ( $by_purpose as $i => $r ) {
		$parts                     = explode( '|', (string) $r['k'], 2 );
		$pp                        = (string) ( $parts[1] ?? '' );
		$by_purpose[ $i ]['label'] = flxai_source_label( $parts[0] ) . ( '' !== $pp ? ' · ' . flxai_purpose_label( $pp ) : '' );
	}
	$by_tool    = (array) $wpdb->get_results(
		"SELECT tool AS k, source, COUNT(*) AS n, AVG(ms) AS avg_ms, MAX(ms) AS max_ms, SUM(ms) AS total_ms, SUM(ok=0) AS errors
		FROM {$t} WHERE {$w} AND kind='tool' GROUP BY tool, source ORDER BY total_ms DESC LIMIT 40", // phpcs:ignore
		ARRAY_A
	);
	$tools = flxai_tools_all();
	foreach ( $by_tool as $i => $r ) {
		$by_tool[ $i ]['label'] = (string) ( $tools[ $r['k'] ]['title'] ?? $r['k'] );
	}
	return array(
		'from'       => (int) $from,
		'to'         => (int) $to,
		'totals'     => $totals,
		'daily'      => $daily,
		'by_source'  => $by_source,
		'by_model'   => $by_model,
		'by_tool'    => $by_tool,
		'by_purpose' => $by_purpose,
	);
}

/** Ay aralığı (Y-m) → array( from, to ) site saat dilimine göre. */
function flxai_month_range( $ym ) {
	$tz = wp_timezone();
	if ( ! preg_match( '/^\d{4}-(?:0[1-9]|1[0-2])$/', (string) $ym ) ) {
		$ym = wp_date( 'Y-m' );
	}
	$a = new DateTimeImmutable( $ym . '-01 00:00:00', $tz );
	return array( $a->getTimestamp(), $a->modify( 'first day of next month' )->getTimestamp() );
}

/** Son 12 ayın toplamları (faturalandırma listesi). */
function flxai_months( $n = 12 ) {
	$out = array();
	$tz  = wp_timezone();
	$cur = new DateTimeImmutable( wp_date( 'Y-m' ) . '-01 00:00:00', $tz );
	global $wpdb;
	for ( $i = 0; $i < $n; $i++ ) {
		$m              = $cur->modify( "-{$i} months" );
		list( $f, $to ) = flxai_month_range( $m->format( 'Y-m' ) );
		$r              = $wpdb->get_row( $wpdb->prepare( 'SELECT SUM(cost) AS cost, SUM(full_cost) AS full_cost, SUM(kind=\'model\') AS calls FROM ' . flxai_table( 'log' ) . ' WHERE ts >= %d AND ts < %d', $f, $to ), ARRAY_A ); // phpcs:ignore
		$out[]          = array(
			'ym'    => $m->format( 'Y-m' ),
			'label' => flx_date( $f, 'F Y' ),
			'cost'  => (float) ( $r['cost'] ?? 0 ),
			'saved' => max( 0, (float) ( $r['full_cost'] ?? 0 ) - (float) ( $r['cost'] ?? 0 ) ),
			'calls' => (int) ( $r['calls'] ?? 0 ),
		);
	}
	return $out;
}

/** Faturalandırma: ay dökümü (sağlayıcı, kaynak, model). */
function flxai_billing( $ym ) {
	global $wpdb;
	list( $from, $to ) = flxai_month_range( $ym );
	$rep               = flxai_report( 0, '', $from, $to );
	$w                 = flxai_report_where( $from, $to );
	$by_provider       = (array) $wpdb->get_results(
		"SELECT provider AS k, SUM(cost) AS cost, SUM(full_cost) AS full_cost, COUNT(*) AS calls, SUM(est) AS est, SUM(in_tok) AS in_tok, SUM(out_tok) AS out_tok
		FROM " . flxai_table( 'log' ) . " WHERE {$w} AND kind='model' GROUP BY provider ORDER BY cost DESC", // phpcs:ignore
		ARRAY_A
	);
	$labels = flxai_provider_labels();
	foreach ( $by_provider as $i => $r ) {
		$by_provider[ $i ]['label'] = $labels[ $r['k'] ] ?? ( '' !== $r['k'] ? $r['k'] : '—' );
	}
	$rep['by_provider'] = $by_provider;
	$rep['ym']          = wp_date( 'Y-m', $from );
	return $rep;
}

/** OpenRouter anahtar bilgisi: kullanım ve kalan kredi (yalnız yönetici "Yenile"ye basınca). */
function flxai_openrouter_credits() {
	$key = flxai_setting( 'key_openrouter' );
	if ( '' === $key ) {
		return new WP_Error( 'flxai_key', __( 'OpenRouter anahtarı girilmemiş.', 'flx-ai' ) );
	}
	$out = array();
	foreach ( array( 'key' => '/key', 'credits' => '/credits' ) as $k => $path ) {
		$r = wp_remote_get(
			flxai_openrouter_base() . $path,
			array(
				'timeout' => 15,
				'headers' => array( 'Authorization' => 'Bearer ' . $key ),
			)
		);
		if ( is_wp_error( $r ) ) {
			continue;
		}
		$json        = json_decode( (string) wp_remote_retrieve_body( $r ), true );
		$out[ $k ]   = is_array( $json['data'] ?? null ) ? $json['data'] : array();
		$out['code'] = (int) wp_remote_retrieve_response_code( $r );
	}
	$res = array(
		'checked'   => time(),
		'usage'     => isset( $out['key']['usage'] ) ? (float) $out['key']['usage'] : null,
		'limit'     => isset( $out['key']['limit'] ) ? (float) $out['key']['limit'] : null,
		'remaining' => isset( $out['key']['limit_remaining'] ) ? (float) $out['key']['limit_remaining'] : null,
		'credits'   => isset( $out['credits']['total_credits'] ) ? (float) $out['credits']['total_credits'] - (float) ( $out['credits']['total_usage'] ?? 0 ) : null,
	);
	update_option( 'flxai_or_credits', $res, false );
	return $res;
}

/** The same monthly export is used by the admin download and authenticated app API. */
function flxai_billing_csv( $ym ) {
	global $wpdb;
	list( $from, $to ) = flxai_month_range( $ym );
	$fh = fopen( 'php://temp', 'w+' ); // phpcs:ignore
	fwrite( $fh, "\xEF\xBB\xBF" ); // phpcs:ignore
	fputcsv( $fh, array( 'time', 'kind', 'source', 'purpose', 'user_id', 'provider', 'model', 'tool', 'in_tokens', 'out_tokens', 'cache_read', 'cache_write', 'cost_usd', 'cost_without_cache_usd', 'estimated', 'ms', 'ok', 'error' ), ',', '"', '' );
	$cursor = 0;
	$at = $from;
	$through = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(id) FROM ' . flxai_table( 'log' ) . ' WHERE ts >= %d AND ts < %d', $from, $to ) ); // phpcs:ignore
	do {
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT id, ts, kind, source, purpose, user_id, provider, model, tool, in_tok, out_tok, cache_read, cache_write, cost, full_cost, est, ms, ok, error FROM ' . flxai_table( 'log' ) . ' WHERE ts >= %d AND ts < %d AND id <= %d AND (ts > %d OR (ts = %d AND id > %d)) ORDER BY ts, id LIMIT 500', $from, $to, $through, $at, $at, $cursor ), ARRAY_A ); // phpcs:ignore
		foreach ( (array) $rows as $r ) {
			$values = array( wp_date( 'Y-m-d H:i:s', (int) $r['ts'] ), $r['kind'], $r['source'], $r['purpose'], $r['user_id'], $r['provider'], $r['model'], $r['tool'], $r['in_tok'], $r['out_tok'], $r['cache_read'], $r['cache_write'], $r['cost'], $r['full_cost'], $r['est'], $r['ms'], $r['ok'], $r['error'] );
			foreach ( $values as &$value ) {
				if ( is_string( $value ) && ! is_numeric( $value ) && preg_match( '/^\s*[=+@-]|^[\t\r]/u', $value ) ) {
					$value = "'" . $value;
				}
			}
			unset( $value );
			fputcsv( $fh, $values, ',', '"', '' );
			$cursor = (int) $r['id'];
			$at = (int) $r['ts'];
		}
	} while ( count( (array) $rows ) === 500 );
	rewind( $fh );
	$csv = stream_get_contents( $fh );
	fclose( $fh ); // phpcs:ignore
	return array( 'filename' => 'flx-ai-' . wp_date( 'Y-m', $from ) . '.csv', 'csv' => $csv );
}

/** CSV dışa aktarma: seçilen ayın tüm satırları. */
add_action(
	'admin_post_flxai_csv',
	function () {
		if ( ! flxai_can_manage() ) {
			wp_die( esc_html__( 'Yetkiniz yok.', 'flx-ai' ), 403 );
		}
		check_admin_referer( 'flxai_csv' );
		$export = flxai_billing_csv( sanitize_text_field( wp_unslash( $_GET['ym'] ?? '' ) ) );
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . $export['filename'] . '"' );
		echo $export['csv']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- CSV, not HTML.
		exit;
	}
);
