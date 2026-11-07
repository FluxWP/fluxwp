<?php
/** Exercise the actual shared sanitizer and native REST handler without WordPress/network. */
define( 'ABSPATH', __DIR__ );
$options = array( 'blogname' => 'Example site', 'blogdescription' => 'Example description' );
$actions = array(); $routes = array(); $writes = 0; $terms = 0; $flushes = 0; $manager = true;
function add_action( $hook, $cb, ...$args ) { global $actions; $actions[ $hook ][] = $cb; }
function add_filter( ...$args ) {}
function apply_filters( $hook, $value, ...$args ) { return $value; }
function __( $text, $domain = '' ) { return $text; }
function current_user_can( $cap ) { global $manager; return 'manage_options' === $cap && $manager; }
function get_option( $name, $default = false ) { global $options; return $options[ $name ] ?? $default; }
function update_option( $name, $value, ...$args ) { global $options, $writes; $options[ $name ] = $value; ++$writes; }
function wp_parse_args( $values, $defaults ) { return array_merge( $defaults, (array) $values ); }
function sanitize_key( $key ) { return strtolower( preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) $key ) ); }
function sanitize_text_field( $text ) { return trim( strip_tags( $text ) ); }
function sanitize_textarea_field( $text ) { return trim( strip_tags( $text ) ); }
function post_type_exists( $type ) { return in_array( $type, array( 'post', 'page', 'proje', 'etkinlik' ), true ); }
function get_post_types( $args, $format ) { return array_map( function ( $id ) { return (object) array( 'name' => $id, 'labels' => (object) array( 'singular_name' => ucfirst( $id ) ) ); }, array( 'post', 'page' ) ); }
function flxl_text_fields() { return array( 'blogname' => array( 'option' => 'blogname', 'label' => 'Site name' ), 'blogdescription' => array( 'option' => 'blogdescription', 'label' => 'Description', 'textarea' => true ) ); }
function flxl_raw( $cb ) { return $cb(); }
function flxl_ensure_terms() { global $terms, $ensured_default; ++$terms; $ensured_default = flxl_default_language(); }
function flxl_index_flush() { global $flushes; ++$flushes; }
function wp_json_encode( $value ) { return json_encode( $value ); }
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function register_rest_route( $namespace, $path, $args ) { global $routes; $routes[ $args['methods'] ] = $args; }
class WP_Error { public $data; public $message; public function __construct( $code, $message, $data = array() ) { $this->message = $message; $this->data = $data; } }
class WP_REST_Request { private $params; public function __construct( $params ) { $this->params = $params; } public function get_json_params() { return $this->params; } }
require __DIR__ . '/../../plugins/flx-lang/includes/diller.php';
require __DIR__ . '/../../plugins/flx-lang/includes/native-settings.php';
foreach ( $actions['rest_api_init'] as $cb ) { $cb(); }
function check( $value, $message ) { if ( ! $value ) { throw new RuntimeException( $message ); } }
function send( $method, $body = array() ) { global $routes; if ( ! call_user_func( $routes[ $method ]['permission_callback'] ) ) { return new WP_Error( 'forbidden', 'Forbidden', array( 'status' => 403 ) ); } return call_user_func( $routes[ $method ]['callback'], new WP_REST_Request( $body ) ); }
function payload() {
	$s = flxl_settings();
	return array( 'version' => flxl_native_configuration()['version'], 'langs' => $s['languages'], 'default' => $s['default'], 'post_types' => $s['post_types'], 'fallback' => $s['fallback'], 'suggest' => $s['suggest'], 'suggest_to' => $s['suggest_to'], 'switcher' => $s['switcher'], 'switcher_place' => $s['switcher_place'], 'home_countries' => implode( ', ', $s['home_countries'] ), 'texts' => $s['texts'] );
}
function rejects( $body, $status, $label ) { global $writes; $before = $writes; $result = send( 'POST', $body ); check( is_wp_error( $result ) && $result->data['status'] === $status && $before === $writes, $label ); }
$manager = false;
check( is_wp_error( send( 'GET' ) ) && is_wp_error( send( 'POST', array() ) ) && 0 === $writes, 'Only managers can read or write site language configuration' );
$manager = true;
$options['flxl_settings'] = flxl_default_settings() + array( 'extension_private' => 'not-for-the-client' );
flxl_settings( true );
$get = send( 'GET' );
check( ! isset( $get['settings']['extension_private'] ) && count( $get['catalog'] ) >= 2 && count( $get['text_fields'] ) === 2 && $get['text_fields'][0]['base'] === 'Example site', 'Read contract exposes only owned settings and editable text metadata' );
$input = payload(); $input['version'] = 'old'; rejects( $input, 409, 'Old revisions cannot overwrite settings' );
$input = payload(); unset( $input['texts'] ); rejects( $input, 400, 'Partial payload cannot silently erase untranslated sections' );
$input = payload(); $input['langs'] = 'wrong'; rejects( $input, 400, 'Malformed language containers do not write' );
$input = payload(); $input['langs']['en']['name'] = array( 'wrong' ); rejects( $input, 400, 'Nested malformed fields do not write' );
$input = payload(); $input['langs']['en']['active'] = 'false'; rejects( $input, 400, 'Ambiguous booleans do not write' );
$input = payload(); $input['texts'] = array( 'en' => array( 'blogname' => array( 'wrong' ) ) ); rejects( $input, 400, 'Malformed text values do not write' );
$input = payload(); $input['post_types'] = array( array( 'wrong' ) ); rejects( $input, 400, 'Malformed content types do not write' );
$input = payload(); $input['home_countries'] = array( 'TR' ); rejects( $input, 400, 'Wrong country format does not write' );
$input = payload();
$input['langs']['tr']['active'] = 0;
$input['langs']['en']['name'] = '<b>English</b>';
$input['langs']['en']['locale'] = 'en_US<script>';
$input['add_lang'] = 'de';
$input['post_types'] = array( 'post', 'not-installed' );
$input['home_countries'] = 'tr, CY; tr invalid ABC 55';
$input['texts'] = array( 'en' => array( 'blogname' => '<b>English site</b>', 'blogdescription' => "First\nsecond", 'unknown' => 'discard' ), 'tr' => array( 'blogname' => 'not a translation' ), 'zz' => array( 'blogname' => 'not configured' ) );
$result = send( 'POST', $input );
check( ! is_wp_error( $result ) && $writes === 1 && $terms === 1 && $flushes === 1, 'A valid write updates settings and refreshes indexes once' );
$s = flxl_settings();
check( $s['languages']['tr']['active'] === 1 && $s['languages']['en']['name'] === 'English' && $s['languages']['de']['active'] === 0, 'Default language stays active and new languages start inactive' );
check( array( 'post' ) === $s['post_types'] && array( 'TR', 'CY' ) === $s['home_countries'], 'Content types and country codes are validated and deduplicated' );
check( array( 'en' => array( 'blogname' => 'English site', 'blogdescription' => "First\nsecond" ) ) === $s['texts'], 'Only allowed fields for configured non-default languages survive' );
check( $options['flxl_settings']['extension_private'] === 'not-for-the-client' && ! isset( $result['settings']['extension_private'] ), 'Foreign option data is preserved on the server and never returned' );
check( $result['version'] !== $input['version'] && $result['settings'] === array_intersect_key( $s, flxl_default_settings() ), 'Returned settings and revision reflect the just-saved configuration' );
$input = payload(); $input['default'] = 'de'; $input['langs']['de']['active'] = 0;
$result = send( 'POST', $input );
check( $result['settings']['default'] === 'de' && $result['settings']['languages']['de']['active'] === 1 && $ensured_default === 'de', 'Index/term refresh sees the new default rather than cached settings' );
$input = payload(); $input['langs'] = array(); $input['default'] = 'missing';
$result = send( 'POST', $input );
check( isset( $result['settings']['languages'][ $result['settings']['default'] ] ), 'An empty language submission cannot leave an invalid default' );
$input = payload(); $input['langs'] = array( 'fr' => array( 'name' => 'French', 'locale' => 'fr_FR', 'flag' => '', 'active' => 1 ) ); $input['default'] = 'fr'; $input['suggest_to'] = 'missing';
$result = send( 'POST', $input );
check( $result['settings']['suggest_to'] === 'fr', 'Missing suggestion targets fall back to a configured language' );
echo "Native language settings contracts: OK\n";
