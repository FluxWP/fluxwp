<?php
/** Disposable real-WordPress tool administration regression. No tool callback is executed. */
if ( ! defined( 'FLUX_NATIVE_QA' ) || ! FLUX_NATIVE_QA || 'local' !== wp_get_environment_type() ) { throw new RuntimeException( 'Isolated local QA required.' ); }
function tools_assert( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } }
function tools_request( $method = 'GET', array $data = array() ) {
	$request = new WP_REST_Request( $method, '/flx-ai/v1/admin/tools' );
	if ( 'GET' === $method ) { $request->set_query_params( $data ); }
	else { $request->set_header( 'Content-Type', 'application/json' ); $request->set_body( wp_json_encode( $data ) ); }
	return rest_do_request( $request );
}
$prefix = 'nativeqa_' . bin2hex( random_bytes( 4 ) );
$old_user = get_current_user_id(); $original = get_option( 'flxai_settings', null ); $subscriber = 0; $other = null; $runs = 0;
$definition = static function ( $name, $source, $read = true, $aliases = array() ) use ( &$runs ) {
	return array( 'title' => $name, 'description' => 'QA tool', 'source' => $source, 'readonly' => $read, 'cap' => 'read', 'schema' => array( 'type' => 'object', 'properties' => new stdClass() ), 'aliases' => $aliases, 'run' => static function () use ( &$runs ) { ++$runs; return array( 'internal_callback_secret' => 'must-not-be-serialized' ); } );
};
$primary = static function ( $tools ) use ( $prefix, $definition ) {
	for ( $i = 0; $i < 65; $i++ ) {
		$name = $prefix . '_tool_' . str_pad( $i, 2, '0', STR_PAD_LEFT );
		$tools[ $name ] = $definition( $name, 'qa-primary', 0 === $i % 2 );
		if ( 0 === $i ) { $tools[ $name ]['title'] = 'İçerik işlemi'; }
	}
	$tools[ $prefix . '_conflict' ] = $definition( $prefix . '_conflict', 'qa-primary', true, array( $prefix . '_old' ) );
	return $tools;
};
$rival = static function ( $tools ) use ( $prefix, $definition ) { $tools[ $prefix . '_conflict' ] = $definition( $prefix . '_conflict', 'qa-rival', false ); return $tools; };
$mcp = static function ( $tools ) use ( $prefix, $definition ) { $tools[ $prefix . '_mcp' ] = $definition( $prefix . '_mcp', 'qa-primary' ); return $tools; };
add_filter( 'flxai_tools', $primary, 90 ); add_filter( 'flxai_tools', $rival, 91 ); add_filter( 'flx_mcp_tools', $mcp, 90 );
try {
	global $wpdb;
	foreach ( array( array( $prefix . '_old', 100, 1, time() ), array( $prefix . '_conflict', 300, 1, time() ), array( $prefix . '_conflict', 500, 0, time() ), array( $prefix . '_conflict', 9000, 0, time() - 40 * DAY_IN_SECONDS ) ) as $event ) {
		tools_assert( false !== $wpdb->insert( flxai_table( 'log' ), array( 'ts' => $event[3], 'kind' => 'tool', 'source' => $prefix, 'tool' => $event[0], 'ms' => $event[1], 'ok' => $event[2] ) ), 'Usage fixture failed.' );
	}
	wp_set_current_user( 0 );
	foreach ( array( 'GET', 'POST' ) as $method ) { tools_assert( in_array( tools_request( $method )->get_status(), array( 401, 403 ), true ), 'Anonymous administration must be denied.' ); }
	$subscriber = wp_insert_user( array( 'user_login' => $prefix, 'user_pass' => wp_generate_password( 32 ), 'role' => 'subscriber' ) );
	tools_assert( ! is_wp_error( $subscriber ), 'Subscriber fixture failed.' ); wp_set_current_user( $subscriber );
	foreach ( array( 'GET', 'POST' ) as $method ) { tools_assert( 403 === tools_request( $method )->get_status(), 'Subscriber must not administer tools.' ); }
	wp_set_current_user( get_user_by( 'login', 'fluxqa' )->ID );
	flxai_update_settings( array( 'tools_off' => array( 'inactive_plugin_tool', $prefix . '_old' ), 'tool_pick' => array(), 'key_openrouter' => 'QA-SECRET-NEVER-RETURN' ) );
	$secret = get_option( 'flxai_settings' )['key_openrouter'];
	$first = tools_request( 'GET', array( 'q' => $prefix, 'per_page' => 30 ) ); tools_assert( 200 === $first->get_status(), 'Catalogue failed.' );
	$data = $first->get_data();
	tools_assert( 68 === $data['total'] && 67 === $data['selectable_total'] && 3 === $data['pages'] && 30 === count( $data['items'] ), 'Pagination or duplicate counts wrong.' );
	$all = $data['items'];
	foreach ( array( 2, 3 ) as $page ) { $all = array_merge( $all, tools_request( 'GET', array( 'q' => $prefix, 'page' => $page, 'per_page' => 30 ) )->get_data()['items'] ); }
	tools_assert( 68 === count( array_unique( array_column( $all, 'id' ) ) ), 'Paging skipped or repeated a definition.' );
	if ( function_exists( 'flxai_page_tools' ) ) {
		ob_start(); flxai_page_tools(); $html = ob_get_clean();
		tools_assert( false !== strpos( $html, 'name="revision" value="' . esc_attr( $data['revision'] ) . '"' ) && false !== strpos( $html, $prefix . '_tool_64' ), 'WordPress tools page must render the shared revision and full catalogue.' );
		tools_assert( false === strpos( $html, 'QA-SECRET' ), 'WordPress page exposed a provider secret.' );
	}
	$usage = array_values( array_filter( $all, static function ( $row ) use ( $prefix ) { return $row['name'] === $prefix . '_conflict' && ! $row['dupe']; } ) )[0]['usage'];
	tools_assert( 3 === $usage['n'] && 1 === $usage['errors'] && abs( 300 - $usage['avg_ms'] ) < 0.001, 'Usage must combine legacy aliases and callers, weight durations, and exclude old events.' );
	$json = wp_json_encode( $data ); tools_assert( false === strpos( $json, 'QA-SECRET' ) && false === strpos( $json, 'internal_callback_secret' ) && false === strpos( $json, 'must-not-be-serialized' ) && 0 === $runs, 'Catalogue exposed secrets or ran a tool.' );
	$accent = tools_request( 'GET', array( 'q' => 'icerik', 'source' => 'qa-primary' ) )->get_data(); tools_assert( 1 === $accent['total'], 'Unicode search failed.' );
	foreach ( array( array( 'kind' => 'bad' ), array( 'state' => 'bad' ), array( 'page' => -1 ), array( 'per_page' => 101 ), array( 'q' => array( 'bad' ) ) ) as $filter ) { tools_assert( 400 === tools_request( 'GET', $filter )->get_status(), 'Invalid filter must be rejected.' ); }
	$revision = $data['revision'];
	$bad = tools_request( 'POST', array( 'revision' => $revision, 'changes' => array( $prefix . '_tool_01' => false, $prefix . '_missing' => true ) ) );
	tools_assert( 400 === $bad->get_status() && ! flxai_tool_is_off( $prefix . '_tool_01' ), 'Invalid batch was partially applied.' );
	$save = tools_request( 'POST', array( 'revision' => $revision, 'changes' => array( $prefix . '_tool_01' => false, $prefix . '_mcp' => false ) ) );
	tools_assert( 200 === $save->get_status(), 'Valid change failed.' );
	tools_assert( flxai_tool_is_off( $prefix . '_mcp' ) && ! isset( flxai_tools_for_user()[ $prefix . '_mcp' ] ), 'A disabled MCP tool remained available in chat.' );
	tools_assert( in_array( 'inactive_plugin_tool', flxai_tools_off(), true ), 'Inactive-plugin preference was lost.' );
	tools_assert( $secret === get_option( 'flxai_settings' )['key_openrouter'], 'Provider secret was changed.' );
	tools_assert( 409 === tools_request( 'POST', array( 'revision' => $revision, 'changes' => array( $prefix . '_tool_02' => false ) ) )->get_status(), 'Stale form must be rejected.' );
	$get_revision = static function () { return tools_request()->get_data()['revision']; };
	$pick = tools_request( 'POST', array( 'revision' => $get_revision(), 'pick' => array( 'name' => $prefix . '_conflict', 'source' => 'qa-rival' ) ) );
	tools_assert( 200 === $pick->get_status(), 'Conflict choice failed.' );
	$chosen = array_values( array_filter( flxai_tools_rows(), static function ( $row ) use ( $prefix ) { return $row['name'] === $prefix . '_conflict' && ! $row['dupe']; } ) )[0];
	tools_assert( 'qa-rival' === $chosen['source'] && $chosen['approval'] && flxai_tool_is_off( $prefix . '_conflict' ), 'Conflict choice changed disabled state or bypassed approval.' );
	tools_assert( 400 === tools_request( 'POST', array( 'revision' => $get_revision(), 'pick' => array( 'name' => $prefix . '_conflict', 'source' => 'unknown' ) ) )->get_status(), 'Unknown definition accepted.' );
	$bulk = tools_request( 'POST', array( 'revision' => $get_revision(), 'bulk' => array( 'enabled' => false, 'filter' => array( 'source' => 'qa-primary', 'kind' => 'read', 'q' => $prefix ), 'exclude' => array( $prefix . '_tool_00' ) ) ) );
	tools_assert( 200 === $bulk->get_status(), 'Matching bulk operation failed.' );
	tools_assert( ! flxai_tool_is_off( $prefix . '_tool_00' ) && flxai_tool_is_off( $prefix . '_tool_64' ), 'Matching operation ignored exclusion or later pages.' );
	tools_assert( ! flxai_tool_is_off( $prefix . '_tool_03' ), 'Matching operation changed an unrelated write tool.' );
	global $wpdb;
	$other = new wpdb( DB_USER, DB_PASSWORD, DB_NAME, DB_HOST );
	tools_assert( 1 === (int) $other->get_var( $other->prepare( 'SELECT GET_LOCK(%s, 0)', flxai_admin_tools_lock_name() ) ), 'Fixture lock failed.' );
	$busy = tools_request( 'POST', array( 'revision' => $get_revision(), 'changes' => array( $prefix . '_tool_03' => false ) ) );
	tools_assert( 409 === $busy->get_status() && 'flxai_busy' === $busy->get_data()['code'] && ! flxai_tool_is_off( $prefix . '_tool_03' ), 'Concurrent change must wait without writing.' );
	tools_assert( 0 === $runs, 'Administration executed a tool callback.' );
	echo "PASS: tools permissions, 68-definition paging, weighted 30-day usage, Unicode filters, secret isolation, atomic validation, alias/conflict controls, matching bulk exclusions and concurrent-save guard.\n";
} finally {
	$wpdb->delete( flxai_table( 'log' ), array( 'source' => $prefix ) );
	if ( $other ) { $other->get_var( $other->prepare( 'SELECT RELEASE_LOCK(%s)', flxai_admin_tools_lock_name() ) ); $other->close(); }
	remove_filter( 'flxai_tools', $primary, 90 ); remove_filter( 'flxai_tools', $rival, 91 ); remove_filter( 'flx_mcp_tools', $mcp, 90 );
	if ( null === $original ) { delete_option( 'flxai_settings' ); } else { update_option( 'flxai_settings', $original, true ); }
	$GLOBALS['flxai_settings_cache'] = null; flxai_chat_registry( true );
	wp_set_current_user( $old_user );
	if ( $subscriber && ! is_wp_error( $subscriber ) ) { require_once ABSPATH . 'wp-admin/includes/user.php'; wp_delete_user( $subscriber ); }
}
