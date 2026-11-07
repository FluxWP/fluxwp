<?php
/** Offline REST authorization/atomicity contracts; calls production handlers, no network/database. */
define( 'ABSPATH', __DIR__ );
$actions = array(); $filters = array(); $routes = array(); $options = array(); $roles = array(); $users = array(); $writes = 0; $phone_writes = 0; $ref_writes = 0;
$permissions = array( 'manage_options' => true, 'list_users' => true, 'promote_users' => true, 'edit_user' => true );
function add_action( $hook, $cb, ...$args ) { global $actions; $actions[ $hook ][] = $cb; }
function add_filter( $hook, $cb, ...$args ) { global $filters; $filters[ $hook ][] = $cb; }
function apply_filters( $hook, $value, ...$args ) { return $value; }
function __( $text, $domain = '' ) { return $text; }
function current_user_can( $cap, ...$args ) { global $permissions; return ! empty( $permissions[ $cap ] ); }
function get_option( $name, $default = false ) { global $options; return $options[ $name ] ?? $default; }
function update_option( $name, $value, ...$args ) { global $options, $writes; $options[ $name ] = $value; ++$writes; }
function wp_parse_args( $values, $defaults ) { return array_merge( $defaults, (array) $values ); }
function wp_json_encode( $value ) { return json_encode( $value ); }
function get_role( $id ) { global $roles; return $roles[ $id ] ?? null; }
function add_role( $id, $name, $caps ) { global $roles; $roles[ $id ] = new NativeTestRole( $caps ); }
function remove_role( $id ) { global $roles; unset( $roles[ $id ] ); }
function count_users() { global $users; $counts = array(); foreach ( $users as $u ) { foreach ( $u->roles as $role ) { $counts[ $role ] = ( $counts[ $role ] ?? 0 ) + 1; } } return array( 'avail_roles' => $counts ); }
function get_users( $args ) { global $users; return array_values( array_filter( $users, function ( $u ) use ( $args ) { return ! isset( $args['role'] ) || in_array( $args['role'], $u->roles, true ); } ) ); }
function get_userdata( $id ) { global $users; return $users[ $id ] ?? null; }
function get_user_by( $field, $value ) { global $users; foreach ( $users as $u ) { if ( $value === ( 'email' === $field ? $u->user_email : $u->user_login ) ) { return $u; } } return false; }
function user_can( $user, $cap ) { foreach ( $user->roles as $id ) { $r = get_role( $id ); if ( $r && ! empty( $r->capabilities[ $cap ] ) ) { return true; } } return false; }
function sanitize_key( $s ) { return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', $s ) ); }
function sanitize_text_field( $s ) { return trim( strip_tags( $s ) ); }
function wp_strip_all_tags( $s ) { return strip_tags( $s ); }
function remove_accents( $s ) { return $s; }
function sanitize_title( $s ) { return strtolower( preg_replace( '/[^a-zA-Z0-9-]/', '', $s ) ); }
if ( ! function_exists( 'mb_strlen' ) ) { function mb_strlen( $s ) { return strlen( $s ); } }
function is_email( $s ) { return false !== strpos( $s, '@' ); }
function is_wp_error( $r ) { return $r instanceof WP_Error; }
function flxr_home_choices() { return array( 'auto' => array( 'Auto' ), 'tasks' => array( 'Tasks' ) ); }
function flxr_user_phone( $id ) { return '+90 555 000 00 ' . $id; }
function flxr_set_user_phone( $id, $phone ) { global $phone_writes; ++$phone_writes; return true; }
function flxr_ref_link( $id ) { global $ref_writes; ++$ref_writes; return 'https://example.test/?ref=local-' . $id; }
function register_rest_route( $namespace, $route, $args ) { global $routes; $routes[] = array( $namespace, $route, $args ); }
class WP_Error { public $data; public $message; public function __construct( $code, $message, $data = array() ) { $this->message = $message; $this->data = $data; } public function get_error_message() { return $this->message; } }
class WP_REST_Request implements ArrayAccess {
	private $params; public function __construct( $params = array() ) { $this->params = $params; }
	public function get_json_params() { return $this->params; } public function get_param( $key ) { return $this->params[ $key ] ?? null; }
	public function offsetExists( $key ): bool { return isset( $this->params[ $key ] ); }
	#[ReturnTypeWillChange]
	public function offsetGet( $key ) { return $this->get_param( $key ); }
	public function offsetSet( $key, $value ): void { $this->params[ $key ] = $value; } public function offsetUnset( $key ): void { unset( $this->params[ $key ] ); }
}
class NativeTestRole {
	public $capabilities; public function __construct( $caps ) { $this->capabilities = $caps; }
	public function add_cap( $cap ) { global $writes; $this->capabilities[ $cap ] = true; ++$writes; }
	public function remove_cap( $cap ) { global $writes; unset( $this->capabilities[ $cap ] ); ++$writes; }
}
class NativeTestUser {
	public $ID; public $roles; public $display_name; public $user_login; public $user_email;
	public function __construct( $id, $role ) { $this->ID = $id; $this->roles = array( $role ); $this->display_name = 'Example ' . $id; $this->user_login = 'example' . $id; $this->user_email = 'example' . $id . '@example.test'; }
	public function add_role( $role ) { global $writes; if ( ! in_array( $role, $this->roles, true ) ) { $this->roles[] = $role; } ++$writes; }
	public function remove_role( $role ) { global $writes; $this->roles = array_values( array_diff( $this->roles, array( $role ) ) ); ++$writes; }
}
class WP_User_Query {
	private $args; public function __construct( $args ) { global $last_query; $last_query = $args; $this->args = $args; }
	public function get_results() { return array_slice( get_users( $this->args ), $this->args['offset'], $this->args['number'] ); }
	public function get_total() { return count( get_users( $this->args ) ); }
}
require __DIR__ . '/../../plugins/flx-roles/includes/caps.php';
require __DIR__ . '/../../plugins/flx-roles/includes/rest.php';
foreach ( $actions['rest_api_init'] as $cb ) { $cb(); }
$roles['administrator'] = new NativeTestRole( array( 'read' => true, 'manage_options' => true ) );
foreach ( array_keys( flxr_builtin_roles() ) as $id ) { $roles[ $id ] = new NativeTestRole( array( 'read' => true, FLXR_CAP_REF => true ) ); }
$roles['subscriber'] = new NativeTestRole( array( 'read' => true ) );
$roles['external_role'] = new NativeTestRole( array( 'read' => true ) );
$users[1] = new NativeTestUser( 1, FLXR_ROLE_STAFF ); $users[2] = new NativeTestUser( 2, 'administrator' ); $users[3] = new NativeTestUser( 3, 'subscriber' ); $users[3]->roles[] = 'external_role';
function request( $path, $method, $params = array() ) {
	global $routes;
	foreach ( $routes as $route ) {
		$matches = array();
		if ( $method !== $route[2]['methods'] || ! preg_match( '#^/' . $route[0] . $route[1] . '$#', $path, $matches ) ) { continue; }
		foreach ( $matches as $key => $value ) { if ( is_string( $key ) ) { $params[ $key ] = $value; } }
		$r = new WP_REST_Request( $params );
		if ( ! call_user_func( $route[2]['permission_callback'], $r ) ) { return new WP_Error( 'forbidden', 'Forbidden', array( 'status' => 403 ) ); }
		return call_user_func( $route[2]['callback'], $r );
	}
	throw new RuntimeException( 'Missing route ' . $method . ' ' . $path );
}
function check( $condition, $message ) { if ( ! $condition ) { throw new RuntimeException( $message ); } }
function rejected( $input, $status, $message ) {
	global $writes; $before = $writes; $result = request( '/flx-roles/v1/matrix', 'POST', $input );
	check( is_wp_error( $result ) && $result->data['status'] === $status && $before === $writes, $message );
}
$permissions['manage_options'] = false;
check( is_wp_error( request( '/flx-roles/v1/matrix', 'GET' ) ), 'Non-managers cannot read the matrix' );
check( is_wp_error( request( '/flx-roles/v1/roles', 'POST', array( 'name' => 'Example' ) ) ) && 0 === $writes, 'Non-managers cannot create a role' );
$permissions['manage_options'] = true; $permissions['list_users'] = false;
check( is_wp_error( request( '/flx-roles/v1/people', 'GET', array( 'role' => FLXR_ROLE_STAFF ) ) ), 'People require list_users independently' );
$permissions['list_users'] = true; $permissions['promote_users'] = false;
check( is_wp_error( request( '/flx-roles/v1/people', 'POST', array( 'role' => FLXR_ROLE_STAFF, 'operation' => 'add', 'who' => 'example3' ) ) ) && 0 === $writes, 'Membership requires promote_users independently' );
$permissions['promote_users'] = true;
$matrix = request( '/flx-roles/v1/matrix', 'GET' ); $version = $matrix['version'];
check( ! in_array( 'administrator', array_column( $matrix['roles'], 'id' ), true ), 'Administrator is never editable in the matrix' );
rejected( array( 'version' => $version, 'caps' => array( FLXR_ROLE_STAFF => array( FLXR_CAP_REF => false, 'manage_options' => true ) ) ), 400, 'An unknown privilege must reject the whole patch before any write' );
rejected( array( 'version' => 'old', 'caps' => array() ), 409, 'Stale settings reject without writes' );
rejected( array( 'version' => $version, 'caps' => array( FLXR_ROLE_STAFF => array( 'read' => false ) ) ), 400, 'Locked read capability cannot be removed' );
rejected( array( 'version' => $version, 'caps' => array( 'administrator' => array( 'read' => true ) ) ), 400, 'Administrator capability changes cannot be injected' );
rejected( array( 'version' => $version, 'caps' => array( FLXR_ROLE_STAFF => array( FLXR_CAP_REF => 'false' ) ) ), 400, 'String booleans are not accepted' );
rejected( array( 'version' => $version, 'caps' => array( FLXR_ROLE_STAFF => array( FLXR_CAP_REF => false ) ), 'ref_days' => 0 ), 400, 'Invalid settings reject all preceding valid capability changes too' );
rejected( array( 'version' => $version, 'caps' => array(), 'home' => array( FLXR_ROLE_STAFF => 'admin-secret' ) ), 400, 'Home targets are allowlisted' );
$saved = request( '/flx-roles/v1/matrix', 'POST', array( 'version' => $version, 'caps' => array( FLXR_ROLE_STAFF => array( FLXR_CAP_REF => false ) ), 'home' => array( FLXR_ROLE_STAFF => 'tasks' ), 'ref_days' => 14 ) );
check( ! is_wp_error( $saved ) && ! flxr_role_has( FLXR_ROLE_STAFF, FLXR_CAP_REF ) && flxr_role_has( FLXR_ROLE_MANAGER, FLXR_CAP_REF ) && $saved['settings']['ref_days'] === 14 && $saved['version'] !== $version, 'A valid patch changes only the requested managed role and returns a new revision' );
$before = $writes;
check( is_wp_error( request( '/flx-roles/v1/people', 'POST', array( 'role' => FLXR_ROLE_STAFF, 'operation' => 'add', 'who' => 'example2' ) ) ) && $writes === $before, 'Administrators cannot be assigned managed roles' );
check( is_wp_error( request( '/flx-roles/v1/people', 'POST', array( 'role' => FLXR_ROLE_STAFF, 'operation' => 'remove', 'user' => 2 ) ) ) && $writes === $before, 'Administrators cannot lose roles through the member endpoint' );
$member = request( '/flx-roles/v1/people', 'POST', array( 'role' => FLXR_ROLE_MANAGER, 'operation' => 'add', 'who' => 'example3@example.test' ) );
check( ! is_wp_error( $member ) && in_array( FLXR_ROLE_MANAGER, $users[3]->roles, true ) && in_array( 'external_role', $users[3]->roles, true ) && ! in_array( 'subscriber', $users[3]->roles, true ), 'Assignment preserves unrelated roles while replacing low-level roles' );
request( '/flx-roles/v1/people', 'GET', array( 'role' => FLXR_ROLE_STAFF, 'per_page' => 10000, 'page' => 2 ) );
check( $last_query['number'] === 100 && $last_query['offset'] === 100 && $ref_writes === 0, 'Reads are bounded and do not generate referral tokens' );
$permissions['edit_user'] = false;
check( is_wp_error( request( '/flx-roles/v1/people/1/phone', 'POST', array( 'phone' => 'local' ) ) ) && 0 === $phone_writes, 'Phone edits enforce edit_user' );
$permissions['edit_user'] = true;
request( '/flx-roles/v1/people/1/phone', 'POST', array( 'phone' => 'local' ) );
check( 1 === $phone_writes, 'Authorized phone edits use the existing validated helper' );
echo "Native role REST contracts: OK\n";
