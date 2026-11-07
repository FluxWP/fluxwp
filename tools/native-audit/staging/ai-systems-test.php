<?php
/** Real WordPress/SDK/database coverage; refuses non-disposable environments. */
if ( ! defined( 'FLUX_NATIVE_QA' ) || ! FLUX_NATIVE_QA || 'local' !== wp_get_environment_type() ) { throw new RuntimeException( 'Isolated local QA required.' ); }
function systems_assert( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } }
function systems_request( $source = '', $method = 'GET', array $data = array() ) {
	$request = new WP_REST_Request( $method, '/flx-ai/v1/admin/systems' . ( $source ? '/' . $source : '' ) );
	if ( 'GET' === $method ) { $request->set_query_params( $data ); } else { $request->set_header( 'Content-Type', 'application/json' ); $request->set_body( wp_json_encode( $data ) ); }
	return rest_do_request( $request );
}
$prefix = 'nativeqa-' . bin2hex( random_bytes( 4 ) ); $source = $prefix . '-system';
$registry = flx_ai_registry(); $settings = get_option( 'flxai_settings', null ); $saved = get_option( FLX_AI_SDK_OPTION, null ); $user = get_current_user_id(); $subscriber = 0; $other = null;
try {
	for ( $i = 0; $i < 35; $i++ ) { flx_ai_plugin( $prefix . '-' . $i, array( 'label' => 'QA ' . $i ) ); }
	flx_ai_plugin( $source, array( 'label' => 'İçerik sistemi', 'description' => 'Disposable settings' ) );
	flx_ai_settings( $source, array(
		'feature' => array( 'type' => 'toggle', 'label' => 'Feature', 'default' => true ),
		'ratio' => array( 'type' => 'number', 'label' => 'Ratio', 'default' => .5, 'min' => .1, 'max' => .9 ),
		'mode' => array( 'type' => 'select', 'label' => 'Mode', 'default' => 'draft', 'options' => array( 'draft' => 'Draft', 'review' => 'Review' ) ),
		'prompt' => array( 'type' => 'textarea', 'label' => 'Prompt', 'default' => '' ),
		'name' => array( 'type' => 'text', 'label' => 'Name', 'default' => 'Sample' ),
		'model' => array( 'type' => 'model', 'label' => 'Model', 'default' => '' ),
		'unknown' => array( 'type' => 'private-custom', 'default' => 'DO-NOT-EXPOSE-UNSUPPORTED' ),
	) );
	wp_set_current_user( 0 );
	foreach ( array( array( '', 'GET' ), array( $source, 'GET' ), array( $source, 'POST' ) ) as $route ) { systems_assert( in_array( systems_request( ...$route )->get_status(), array( 401, 403 ), true ), 'Anonymous access not denied.' ); }
	$subscriber = wp_insert_user( array( 'user_login' => $prefix, 'user_pass' => wp_generate_password( 32 ), 'role' => 'subscriber' ) ); systems_assert( ! is_wp_error( $subscriber ), 'Subscriber fixture failed.' ); wp_set_current_user( $subscriber );
	foreach ( array( array( '', 'GET' ), array( $source, 'GET' ), array( $source, 'POST' ) ) as $route ) { systems_assert( 403 === systems_request( ...$route )->get_status(), 'Subscriber access not denied.' ); }
	wp_set_current_user( get_user_by( 'login', 'fluxqa' )->ID );
	flxai_update_settings( array( 'sources_off' => array( 'inactive-source' ), 'source_models' => array( 'unrelated-source' => 'qa/keep' ), 'key_openrouter' => 'QA-PROVIDER-SECRET' ) ); $key = get_option( 'flxai_settings' )['key_openrouter'];
	flx_ai_set( 'unrelated-sdk', array() );
	$list = systems_request( '', 'GET', array( 'q' => $prefix, 'per_page' => 30 ) )->get_data();
	systems_assert( 36 === $list['total'] && 2 === $list['pages'] && 30 === count( $list['items'] ), 'Systems paging failed.' );
	$next = systems_request( '', 'GET', array( 'q' => $prefix, 'page' => 2, 'per_page' => 30 ) )->get_data(); systems_assert( 6 === count( $next['items'] ) && 36 === count( array_unique( array_merge( array_column( $list['items'], 'source' ), array_column( $next['items'], 'source' ) ) ) ), 'Paging lost/repeated a system.' );
	systems_assert( 1 === systems_request( '', 'GET', array( 'q' => 'icerik sistemi' ) )->get_data()['total'], 'Unicode system search failed.' );
	systems_assert( 404 === systems_request( 'missing-' . $prefix )->get_status(), 'Unknown system accepted.' );
	foreach ( array( array( 'q' => array() ), array( 'page' => 0 ), array( 'per_page' => 101 ) ) as $filter ) { systems_assert( 400 === systems_request( '', 'GET', $filter )->get_status(), 'Invalid filter accepted.' ); }
	$detail = systems_request( $source )->get_data();
	systems_assert( 7 === count( $detail['fields'] ) && false === strpos( wp_json_encode( $detail ), 'QA-PROVIDER-SECRET' ) && false === strpos( wp_json_encode( $detail ), 'DO-NOT-EXPOSE' ), 'Schema missing fields or exposed secrets/unsupported values.' );
	if ( function_exists( 'flxai_page_system_settings' ) ) {
		ob_start(); flxai_page_system_settings( $source ); $html = ob_get_clean();
		systems_assert( false !== strpos( $html, 'name="revision" value="' . esc_attr( $detail['revision'] ) . '"' ) && false === strpos( $html, 'DO-NOT-EXPOSE' ) && false === strpos( $html, 'QA-PROVIDER-SECRET' ), 'WordPress system form must use the same revision without leaking unsupported/provider values.' );
	}
	$body = array( 'revision' => $detail['revision'], 'enabled' => false, 'model' => 'qa/source', 'values' => array( 'ratio' => .25, 'feature' => false, 'mode' => 'review', 'prompt' => "Line one\nLine two", 'name' => '<b>Example</b>', 'model' => 'qa/feature' ) );
	$bad = $body; $bad['values']['mode'] = 'invalid';
	systems_assert( 400 === systems_request( $source, 'POST', $bad )->get_status() && flxai_source_enabled( $source ) && .5 === flx_ai_get( $source, 'ratio' ), 'Invalid form partially applied.' );
	$bad = $body; $bad['values']['feature'] = 'false'; systems_assert( 400 === systems_request( $source, 'POST', $bad )->get_status(), 'String toggle accepted.' );
	$bad = $body; $bad['values']['unknown'] = 'overwrite'; systems_assert( 400 === systems_request( $source, 'POST', $bad )->get_status(), 'Unsupported setting accepted.' );
	$good = systems_request( $source, 'POST', $body ); systems_assert( 200 === $good->get_status(), 'Valid system save failed.' );
	systems_assert( ! flxai_source_enabled( $source ) && .25 === flx_ai_get( $source, 'ratio' ) && false === flx_ai_get( $source, 'feature' ) && 'Example' === flx_ai_get( $source, 'name' ) && "Line one\nLine two" === flx_ai_get( $source, 'prompt' ), 'SDK types/sanitization/fractional values changed.' );
	systems_assert( in_array( 'inactive-source', flxai_setting( 'sources_off' ), true ) && 'qa/keep' === flxai_setting( 'source_models' )['unrelated-source'] && $key === get_option( 'flxai_settings' )['key_openrouter'], 'Unrelated settings or provider secret changed.' );
	systems_assert( 409 === systems_request( $source, 'POST', $body )->get_status(), 'Stale revision accepted.' );
	$body['revision'] = $good->get_data()['revision']; $body['enabled'] = true; $body['model'] = ''; $body['values'] = array( 'ratio' => 5 );
	$clamped = systems_request( $source, 'POST', $body ); systems_assert( 200 === $clamped->get_status() && .9 === flx_ai_get( $source, 'ratio' ) && ! isset( flxai_setting( 'source_models' )[ $source ] ) && 'review' === flx_ai_get( $source, 'mode' ), 'SDK bounds, default-model reset or partial value preservation failed.' );
	$list_revision = flxai_admin_systems_revision( flxai_systems() );
	$bad_toggle = flxai_admin_systems_toggle( array( 'revision' => $list_revision, 'changes' => array( $source => false, 'missing-' . $prefix => true ) ) );
	systems_assert( is_wp_error( $bad_toggle ) && 400 === $bad_toggle->get_error_data()['status'] && flxai_source_enabled( $source ), 'Invalid WordPress list switch batch partially applied.' );
	$toggle = flxai_admin_systems_toggle( array( 'revision' => $list_revision, 'changes' => array( $source => false ) ) );
	systems_assert( ! is_wp_error( $toggle ) && ! flxai_source_enabled( $source ) && in_array( 'inactive-source', flxai_setting( 'sources_off' ), true ) && $key === get_option( 'flxai_settings' )['key_openrouter'], 'WordPress list switches lost unrelated settings.' );
	$stale_toggle = flxai_admin_systems_toggle( array( 'revision' => $list_revision, 'changes' => array( $source => true ) ) );
	systems_assert( is_wp_error( $stale_toggle ) && 409 === $stale_toggle->get_error_data()['status'], 'Stale WordPress list form accepted.' );
	global $wpdb; $other = new wpdb( DB_USER, DB_PASSWORD, DB_NAME, DB_HOST ); $other->get_var( $other->prepare( 'SELECT GET_LOCK(%s,0)', flxai_admin_tools_lock_name() ) );
	$body['revision'] = $clamped->get_data()['revision']; systems_assert( 409 === systems_request( $source, 'POST', $body )->get_status(), 'Concurrent shared-option writer was not blocked.' );
	echo "PASS: system roles, paging, Unicode search, SDK schema/types/fractional bounds, complete validation, unsupported-field isolation, WordPress list switches, stale saves, unrelated preferences and concurrent writer guard.\n";
} finally {
	if ( $other ) { $other->get_var( $other->prepare( 'SELECT RELEASE_LOCK(%s)', flxai_admin_tools_lock_name() ) ); $other->close(); }
	$GLOBALS['flx_ai_sdk_registry'] = $registry;
	foreach ( array( 'flxai_settings' => $settings, FLX_AI_SDK_OPTION => $saved ) as $option => $value ) { if ( null === $value ) { delete_option( $option ); } else { update_option( $option, $value ); } }
	$GLOBALS['flxai_settings_cache'] = null; wp_set_current_user( $user );
	if ( $subscriber && ! is_wp_error( $subscriber ) ) { require_once ABSPATH . 'wp-admin/includes/user.php'; wp_delete_user( $subscriber ); }
}
