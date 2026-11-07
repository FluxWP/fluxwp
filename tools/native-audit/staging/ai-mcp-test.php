<?php
/** Real disposable WordPress regression. Executes only fixture callbacks, never site tools. */
if ( ! defined( 'FLUX_NATIVE_QA' ) || ! FLUX_NATIVE_QA || 'local' !== wp_get_environment_type() ) { throw new RuntimeException( 'Isolated local QA required.' ); }
function mcp_assert( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } }
function mcp_admin_request( $body = null ) {
	$r = new WP_REST_Request( null === $body ? 'GET' : 'POST', '/flx-ai/v1/admin/mcp' );
	if ( null !== $body ) { $r->set_header( 'Content-Type', 'application/json' ); $r->set_body( wp_json_encode( $body ) ); }
	return rest_do_request( $r );
}
function mcp_auth_request( $secret ) { $r = new WP_REST_Request( 'POST', '/flx-mcp/v1/mcp' ); $r->set_header( 'Authorization', 'Bearer ' . $secret ); return flxai_mcp_permission( $r ); }
$prefix = 'nativeqa_' . bin2hex( random_bytes( 4 ) ); $old_user = get_current_user_id(); $saved = array(); $subscriber = 0; $editor = 0; $other = null; $runs = 0;
foreach ( array( 'flxai_settings', 'flxai_mcp_keys', 'flxseo_mcp_keys', 'flxai_mcp_log' ) as $name ) { $saved[ $name ] = get_option( $name, null ); }
$filter = static function ( $tools ) use ( $prefix, &$runs ) {
	foreach ( array( 'read' => 'edit_posts', 'write' => 'edit_posts', 'admin' => 'manage_options' ) as $name => $cap ) {
		$tools[ $prefix . '_' . $name ] = array( 'title' => 'QA ' . $name, 'description' => 'Fixture only', 'source' => 'nativeqa', 'readonly' => 'read' === $name, 'cap' => $cap, 'aliases' => 'read' === $name ? array( $prefix . '_old' ) : array(), 'schema' => array( 'type' => 'object', 'properties' => new stdClass() ), 'run' => static function () use ( &$runs ) { ++$runs; return array( 'fixture' => true ); } );
	}
	return $tools;
};
add_filter( 'flx_mcp_tools', $filter, 90 );
try {
	global $wpdb;
	wp_set_current_user( 0 ); foreach ( array( null, array() ) as $body ) { mcp_assert( in_array( mcp_admin_request( $body )->get_status(), array( 401, 403 ), true ), 'Anonymous admin access allowed.' ); }
	$subscriber = wp_insert_user( array( 'user_login' => $prefix, 'user_pass' => wp_generate_password( 32 ), 'role' => 'subscriber' ) );
	$editor = wp_insert_user( array( 'user_login' => $prefix . '_editor', 'user_pass' => wp_generate_password( 32 ), 'role' => 'editor' ) );
	mcp_assert( ! is_wp_error( $subscriber ) && ! is_wp_error( $editor ), 'User fixtures failed.' ); wp_set_current_user( $subscriber );
	mcp_assert( 403 === mcp_admin_request()->get_status() && 403 === mcp_admin_request( array() )->get_status(), 'Subscriber admin access allowed.' );
	$admin = get_user_by( 'login', 'fluxqa' )->ID; wp_set_current_user( $admin );
	$legacy = array( 'qa-legacy' => array( 'hash' => hash( 'sha256', 'qa-legacy-not-a-real-key' ), 'user' => $admin ) );
	delete_option( 'flxai_mcp_keys' ); update_option( 'flxseo_mcp_keys', $legacy, false );
	mcp_assert( $legacy === flxai_mcp_keys(), 'Legacy key migration failed.' );
	delete_option( 'flxai_mcp_keys' ); get_option( 'flxai_mcp_keys', null ); // Cached miss while a second writer inserts.
	$fresh = array( 'qa-new-writer' => array( 'hash' => hash( 'sha256', 'qa-new-writer-not-a-real-key' ), 'user' => $admin ) );
	$wpdb->insert( $wpdb->options, array( 'option_name' => 'flxai_mcp_keys', 'option_value' => maybe_serialize( $fresh ), 'autoload' => 'no' ) );
	mcp_assert( $fresh === flxai_mcp_keys(), 'First-read migration overwrote a concurrent writer.' );
	update_option( 'flxai_mcp_keys', array(), false ); flxai_update_settings( array( 'mcp_enabled' => 0, 'key_openrouter' => 'QA-PROVIDER-SECRET' ) );
	$provider = get_option( 'flxai_settings' )['key_openrouter']; $state = mcp_admin_request()->get_data();
	mcp_assert( false === $state['enabled'] && 0 === $runs && count( array_filter( $state['tools'], static fn( $t ) => 'nativeqa' === $t['source'] ) ) === 3, 'Metadata ran callbacks or lost tool definitions.' );
	$create = array( 'revision' => $state['revision'], 'action' => 'create', 'name' => 'QA limited', 'scope' => 'selected', 'tools' => array( $prefix . '_old' ) );
	foreach ( array( array( 'tools' => array() ), array( 'tools' => array( 'unknown' ) ), array( 'scope' => 'all' ), array( 'user' => $editor ), array( 'tools' => array( array() ) ) ) as $patch ) {
		mcp_assert( 400 === mcp_admin_request( array_merge( $create, $patch ) )->get_status() && array() === flxai_mcp_keys(), 'Invalid create changed keys.' );
	}
	$result = mcp_admin_request( $create ); mcp_assert( 200 === $result->get_status(), 'Create failed.' ); $data = $result->get_data(); $secret = $data['created']['secret']; $id = $data['created']['id'];
	mcp_assert( 'no-store, private' === $result->get_headers()['Cache-Control'] && ! $data['state']['enabled'], 'Secret response cacheable or create enabled server.' );
	$keys = flxai_mcp_keys(); mcp_assert( $keys[ $id ]['hash'] === hash( 'sha256', $secret ) && $keys[ $id ]['user'] === $admin && array( $prefix . '_read' ) === $keys[ $id ]['tools'], 'Hash, owner or canonical scope incorrect.' );
	$json = wp_json_encode( mcp_admin_request()->get_data() );
	mcp_assert( false === strpos( $json, $secret ) && false === strpos( $json, $keys[ $id ]['hash'] ) && false === strpos( $json, 'QA-PROVIDER-SECRET' ) && false === get_transient( 'flxai_mcp_new_key_' . $admin ), 'Snapshot leaked a credential or native create persisted plaintext.' );
	if ( function_exists( 'flxai_page_mcp' ) ) {
		ob_start(); flxai_page_mcp(); $html = ob_get_clean();
		mcp_assert( false !== strpos( $html, 'name="revision" value="' . esc_attr( $data['state']['revision'] ) . '"' ) && false === strpos( $html, $secret ), 'WordPress forms missing shared revision or exposing native plaintext.' );
	}
	$off = mcp_auth_request( $secret ); mcp_assert( is_wp_error( $off ) && 403 === $off->get_error_data()['status'], 'Disabled server accepted a key.' );
	$toggle = array( 'action' => 'toggle', 'revision' => $data['state']['revision'], 'enabled' => true );
	$on = mcp_admin_request( $toggle ); mcp_assert( 200 === $on->get_status() && flxai_mcp_enabled(), 'Enable failed.' );
	mcp_assert( 409 === mcp_admin_request( $toggle )->get_status(), 'Stale mutation accepted.' );
	$before_usage = mcp_admin_request()->get_data()['revision']; wp_set_current_user( 0 ); mcp_assert( true === mcp_auth_request( $secret ) && get_current_user_id() === $admin, 'Key authentication failed.' );
	mcp_assert( ! flxai_mcp_call( $prefix . '_read', array() )['isError'] && 1 === $runs, 'Allowed fixture callback failed.' );
	mcp_assert( flxai_mcp_call( $prefix . '_write', array() )['isError'] && 1 === $runs, 'Limited key ran an unselected callback.' );
	mcp_assert( $before_usage === mcp_admin_request()->get_data()['revision'] && flxai_mcp_keys()[ $id ]['last_used'] > 0, 'Usage touch invalidated management revision.' );
	flxai_update_settings( array( 'tools_off' => array( $prefix . '_read' ) ) );
	mcp_assert( flxai_mcp_call( $prefix . '_read', array() )['isError'] && 1 === $runs, 'Disabled fixture callback ran.' ); flxai_update_settings( array( 'tools_off' => array() ) );
	// An existing editor-owned unrestricted key must still obey the owner's current capabilities.
	$editor_secret = 'qa-editor-fixture-secret-not-real'; $keys = flxai_mcp_keys(); $keys['qa-editor'] = array( 'hash' => hash( 'sha256', $editor_secret ), 'user' => $editor, 'last_used' => time() ); update_option( 'flxai_mcp_keys', $keys, false );
	wp_set_current_user( 0 ); mcp_assert( true === mcp_auth_request( $editor_secret ) && get_current_user_id() === $editor, 'Editor authentication failed.' );
	mcp_assert( flxai_mcp_call( $prefix . '_admin', array() )['isError'] && 1 === $runs && ! flxai_mcp_call( $prefix . '_write', array() )['isError'] && 2 === $runs, 'Owner capabilities not enforced.' );
	wp_set_current_user( $admin ); $revision = mcp_admin_request()->get_data()['revision'];
	$other = new wpdb( DB_USER, DB_PASSWORD, DB_NAME, DB_HOST ); mcp_assert( 1 === (int) $other->get_var( $other->prepare( 'SELECT GET_LOCK(%s,0)', flxai_admin_tools_lock_name() ) ), 'Fixture lock failed.' );
	mcp_assert( 409 === mcp_admin_request( array( 'revision' => $revision, 'action' => 'revoke', 'id' => $id ) )->get_status(), 'Concurrent mutation not blocked.' );
	$busy = mcp_auth_request( $secret ); mcp_assert( is_wp_error( $busy ) && 503 === $busy->get_error_data()['status'], 'Concurrent authentication did not fail closed.' );
	$other->get_var( $other->prepare( 'SELECT RELEASE_LOCK(%s)', flxai_admin_tools_lock_name() ) ); $other->close(); $other = null;
	set_transient( 'flxai_mcp_new_key_' . $admin, $secret, 300 );
	$revoked = mcp_admin_request( array( 'revision' => $revision, 'action' => 'revoke', 'id' => $id ) ); mcp_assert( 200 === $revoked->get_status() && false === get_transient( 'flxai_mcp_new_key_' . $admin ), 'Revoke failed to clear one-time WP display.' );
	wp_set_current_user( $admin ); // Simulate determine_current_user having authenticated before revocation.
	$denied = mcp_auth_request( $secret ); mcp_assert( is_wp_error( $denied ) && 401 === $denied->get_error_data()['status'] && ! isset( flxai_mcp_keys()[ $id ] ), 'Revoked key regained access via current-user fallback or stale usage write.' );
	$all = mcp_admin_request( array( 'revision' => mcp_admin_request()->get_data()['revision'], 'action' => 'create', 'name' => 'QA all', 'scope' => 'all', 'tools' => array() ) );
	mcp_assert( 200 === $all->get_status() && ! isset( flxai_mcp_keys()[ $all->get_data()['created']['id'] ]['tools'] ), 'Explicit unrestricted scope failed.' );
	mcp_assert( $provider === get_option( 'flxai_settings' )['key_openrouter'], 'MCP mutation changed provider secret.' );
	echo "PASS: MCP roles, strict scope/owner validation, migration race, one-time secret isolation, cache headers, scope aliases, owner capabilities, global disable, usage revisions, concurrent writers and revocation.\n";
} finally {
	if ( $other ) { $other->get_var( $other->prepare( 'SELECT RELEASE_LOCK(%s)', flxai_admin_tools_lock_name() ) ); $other->close(); }
	remove_filter( 'flx_mcp_tools', $filter, 90 );
	foreach ( $saved as $name => $value ) { if ( null === $value ) { delete_option( $name ); } else { update_option( $name, $value ); } }
	flxai_mcp_refresh_options(); flxai_mcp_scope( true, null ); flxai_chat_registry( true ); wp_set_current_user( $old_user );
	require_once ABSPATH . 'wp-admin/includes/user.php'; foreach ( array( $subscriber, $editor ) as $id ) { if ( $id && ! is_wp_error( $id ) ) { wp_delete_user( $id ); } }
}
