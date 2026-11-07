<?php
if ( ! defined( 'FLUX_NATIVE_QA' ) || ! FLUX_NATIVE_QA || 'local' !== wp_get_environment_type() ) { throw new RuntimeException( 'Isolated local QA required.' ); }
$user = get_current_user_id(); $settings = get_option( 'flxai_settings', null ); $keys = get_option( 'flxai_mcp_keys', null );
try {
	wp_set_current_user( get_user_by( 'login', 'fluxqa' )->ID );
	if ( ! flxai_mcp_legacy() ) { throw new RuntimeException( 'Load the legacy fixture before WordPress with --require.' ); }
	$state = flxai_admin_mcp_snapshot();
	if ( ! $state['legacy'] || ! in_array( 'qa_legacy_read', array_column( $state['tools'], 'name' ), true ) ) { throw new RuntimeException( 'Legacy catalogue did not render.' ); }
	foreach ( array( 'toggle', 'create', 'revoke' ) as $action ) {
		$result = flxai_admin_mcp_update( array( 'revision' => $state['revision'], 'action' => $action, 'enabled' => true ) );
		if ( ! is_wp_error( $result ) || 'mcp_legacy' !== $result->get_error_code() || $settings !== get_option( 'flxai_settings', null ) ) { throw new RuntimeException( 'Legacy server mutation was not refused.' ); }
	}
	echo "PASS: preloaded legacy MCP catalogue stays readable and all native mutations fail closed.\n";
} finally {
	if ( null === $keys ) { delete_option( 'flxai_mcp_keys' ); } else { update_option( 'flxai_mcp_keys', $keys ); }
	wp_set_current_user( $user );
}
