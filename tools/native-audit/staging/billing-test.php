<?php
/** Run only with the isolated QA WordPress CLI; all fixtures are removed. */
if ( ! defined( 'FLUX_NATIVE_QA' ) || ! FLUX_NATIVE_QA || 'local' !== wp_get_environment_type() ) {
	throw new RuntimeException( 'Isolated local QA required.' );
}
function billing_assert( $condition, $message ) {
	if ( ! $condition ) { throw new RuntimeException( $message ); }
}
function billing_request( $path, $ym = '' ) {
	$request = new WP_REST_Request( 'GET', '/flx-ai/v1/' . $path );
	$request->set_param( 'ym', $ym );
	return rest_do_request( $request );
}
global $wpdb;
$source = 'native_qa_' . bin2hex( random_bytes( 6 ) );
$table = flxai_table( 'log' );
$old_zone = get_option( 'timezone_string', '' );
$old_user = get_current_user_id();
$subscriber = 0;
$admin = get_user_by( 'login', 'fluxqa' );
billing_assert( $admin && user_can( $admin, 'manage_options' ), 'QA administrator missing.' );
try {
	wp_set_current_user( 0 );
	foreach ( array( 'billing', 'billing/export' ) as $path ) {
		billing_assert( in_array( billing_request( $path )->get_status(), array( 401, 403 ), true ), 'Anonymous access must be denied.' );
	}
	$subscriber = wp_insert_user( array( 'user_login' => $source, 'user_pass' => wp_generate_password( 32 ), 'role' => 'subscriber' ) );
	billing_assert( ! is_wp_error( $subscriber ), 'Subscriber fixture failed.' );
	wp_set_current_user( $subscriber );
	foreach ( array( 'billing', 'billing/export' ) as $path ) {
		billing_assert( 403 === billing_request( $path )->get_status(), 'Subscriber must not see financial reports.' );
	}
	wp_set_current_user( $admin->ID );
	update_option( 'timezone_string', 'Europe/Berlin' );
	$zone = wp_timezone();
	$stamp = ( new DateTimeImmutable( '2001-02-01 00:30:00', $zone ) )->getTimestamp();
	for ( $i = 0; $i < 501; $i++ ) {
		$ok = $wpdb->insert( $table, array( 'ts' => $stamp + intdiv( $i, 10 ), 'kind' => 'model', 'source' => $source, 'purpose' => 'QA', 'provider' => 'qa', 'model' => '=2+3', 'tool' => '', 'in_tok' => 11, 'out_tok' => 7, 'cache_read' => 0, 'cache_write' => 0, 'cost' => 0.125, 'full_cost' => 0.25, 'est' => 1, 'ms' => 20, 'ok' => 1, 'error' => 'Quoted, "value" · Türkçe' ) );
		billing_assert( false !== $ok, 'Log fixture insert failed.' );
	}
	$wpdb->insert( $table, array( 'ts' => ( new DateTimeImmutable( '2001-03-01 00:00:00', $zone ) )->getTimestamp(), 'kind' => 'model', 'source' => $source, 'provider' => 'qa', 'model' => 'outside', 'cost' => 9, 'full_cost' => 9, 'ok' => 1 ) );
	$response = billing_request( 'billing', '2001-02' );
	billing_assert( 200 === $response->get_status(), 'Administrator report failed.' );
	$report = $response->get_data()['month'];
	$rows = array_values( array_filter( $report['by_source'], static function ( $row ) use ( $source ) { return $row['k'] === $source; } ) );
	billing_assert( 1 === count( $rows ) && 501 === (int) $rows[0]['calls'], 'Monthly report lost fixture calls.' );
	billing_assert( abs( (float) $rows[0]['cost'] - 62.625 ) < 0.000001, 'Monthly cost differs from database.' );
	$export = billing_request( 'billing/export', '2001-02' );
	billing_assert( 200 === $export->get_status(), 'Administrator export failed.' );
	$data = $export->get_data();
	billing_assert( 'flx-ai-2001-02.csv' === $data['filename'] && "\xEF\xBB\xBF" === substr( $data['csv'], 0, 3 ), 'Export filename/encoding wrong.' );
	$stream = fopen( 'php://temp', 'w+' ); fwrite( $stream, substr( $data['csv'], 3 ) ); rewind( $stream );
	$header = fgetcsv( $stream, 0, ',', '"', '' );
	billing_assert( 18 === count( $header ), 'CSV columns missing.' );
	$found = 0;
	while ( false !== ( $row = fgetcsv( $stream, 0, ',', '"', '' ) ) ) {
		if ( ( $row[2] ?? '' ) !== $source ) { continue; }
		$found++;
		billing_assert( "'=2+3" === $row[6] && 'Quoted, "value" · Türkçe' === $row[17], 'CSV escaping/formula handling wrong.' );
		billing_assert( 0 === strpos( $row[0], '2001-02-01 ' ), 'CSV must use the site timezone.' );
	}
	fclose( $stream );
	billing_assert( 501 === $found, 'CSV skipped/repeated rows across the 500-row boundary.' );
	billing_assert( 200 === billing_request( 'billing', '2026-13' )->get_status(), 'Malformed month must not crash the API.' );
	$baseline = flxai_billing( '2026-10' );
	$before = array_column( $baseline['daily'], 'calls', 'date' );
	foreach ( array( '2026-10-01 00:30:00', '2026-10-25 00:30:00', '2026-10-25 23:30:00' ) as $when ) {
		$wpdb->insert( $table, array( 'ts' => ( new DateTimeImmutable( $when, $zone ) )->getTimestamp(), 'kind' => 'model', 'source' => $source, 'provider' => 'qa', 'model' => 'qa', 'cost' => 1, 'full_cost' => 1, 'ok' => 1 ) );
	}
	$after = flxai_billing( '2026-10' );
	billing_assert( 31 === count( $after['daily'] ) && '2026-10-01' === $after['daily'][0]['date'], 'Monthly daily chart has an extra day across DST.' );
	$daily = array_column( $after['daily'], 'calls', 'date' );
	billing_assert( 1 === $daily['2026-10-01'] - ( $before['2026-10-01'] ?? 0 ), 'Local midnight before DST was assigned to the wrong date.' );
	billing_assert( 2 === $daily['2026-10-25'] - ( $before['2026-10-25'] ?? 0 ), 'DST transition day lost records.' );
	update_option( 'timezone_string', '+05:45' );
	$wpdb->insert( $table, array( 'ts' => ( new DateTimeImmutable( '2002-01-01 00:15:00', wp_timezone() ) )->getTimestamp(), 'kind' => 'model', 'source' => $source, 'provider' => 'qa', 'model' => 'quarter-hour', 'cost' => 1, 'full_cost' => 1, 'ok' => 1 ) );
	$fixed = flxai_billing( '2002-01' );
	billing_assert( 31 === count( $fixed['daily'] ) && '2002-01-01' === $fixed['daily'][0]['date'] && $fixed['daily'][0]['calls'] >= 1, 'Fixed quarter-hour timezone lost its first-day record.' );
	echo "PASS: billing roles, totals, 501-row CSV, escaping, month validation and DST calendar.\n";
} finally {
	$wpdb->delete( $table, array( 'source' => $source ) );
	update_option( 'timezone_string', $old_zone );
	wp_set_current_user( $old_user );
	if ( $subscriber && ! is_wp_error( $subscriber ) ) {
		require_once ABSPATH . 'wp-admin/includes/user.php'; wp_delete_user( $subscriber );
	}
}
