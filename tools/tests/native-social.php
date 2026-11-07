<?php
/** Offline contract tests call the production store; no WordPress install or outbound network. */
define( 'ABSPATH', __DIR__ ); define( 'ARRAY_A', 'ARRAY_A' );
$can_publish = false; $kicks = 0;
function flxsm_table( $name ) { return $name; }
function flxsm_can_publish() { global $can_publish; return $can_publish; }
function flxsm_json( $v ) { return json_encode( $v ); }
function flxsm_dec( $v ) { return is_array( $v ) ? $v : ( json_decode( (string) $v, true ) ?: array() ); }
function flxsm_media_list( $v ) { return $v; }
function flxsm_provider( $id ) { return new class { public function validate( $payload, $account ) { return array(); } }; }
function __( $s, ...$args ) { return $s; }
function is_wp_error( $v ) { return $v instanceof WP_Error; }
function get_current_user_id() { return 7; }
function do_action( ...$args ) {}
function flxsm_kick() { global $kicks; ++$kicks; }
class WP_Error { public $code; public $data; public function __construct( $code, $message, $data ) { $this->code = $code; $this->data = $data; } }
class SocialTestDb {
 public $writes = array();
 public function prepare( $sql, ...$args ) { return vsprintf( $sql, $args ); }
 public function get_row( $sql, $format ) { return false !== strpos( $sql, 'accounts' ) ? array( 'provider' => 'demo', 'name' => 'Demo', 'status' => 'active' ) : array( 'id' => 51, 'status' => 'pending', 'scheduled_at' => 0, 'content' => 'Common', 'media' => '[]' ); }
 public function get_results( $sql, $format ) { return array( array( 'id' => 61, 'account_id' => 1, 'status' => 'draft', 'content' => null, 'media' => null, 'options' => '{}' ) ); }
 public function query( $sql ) { $this->writes[] = $sql; return 1; }
 public function update( $table, $data, $where ) { $this->writes[] = array( $table, $data, $where ); return 1; }
}
$wpdb = new SocialTestDb();
require __DIR__ . '/../../plugins/flx-social/includes/store.php';
function check( $value, $message ) { if ( ! $value ) { throw new RuntimeException( $message ); } }
$post = array( 'content' => 'Common', 'media' => '[8]' );
$target = array( 'content' => null, 'media' => null, 'options' => '{}' );
check( flxsm_target_payload( $target, $post )['text'] === 'Common', 'Null text must inherit' );
check( flxsm_target_payload( $target, $post )['media'] === array( 8 ), 'Null media must inherit' );
$target['content'] = ''; $target['media'] = '[]';
check( flxsm_target_payload( $target, $post )['text'] === '', 'Explicit empty text must remain empty' );
check( flxsm_target_payload( $target, $post )['media'] === array(), 'Explicit empty media must remain empty' );
$denied = flxsm_save_post( array( 'action' => 'approve' ), 51 );
check( is_wp_error( $denied ) && 403 === $denied->data['status'], 'Saving with approve must require publication permission' );
check( ! $wpdb->writes, 'Denied save must not mutate the draft first' );
$denied = flxsm_apply_action( 51, 'approve' );
check( is_wp_error( $denied ) && 403 === $denied->data['status'], 'Direct approve must require publication permission' );
check( ! $wpdb->writes && ! $kicks, 'Denied action must not change a queue or run publication' );
check( true === flxsm_apply_action( 51, 'now' ), 'Ordinary contributors can submit' );
check( 'pending' === $wpdb->writes[1][1]['status'] && ! $kicks, 'Unauthorized immediate action must become pending, not publish' );
$wpdb->writes = array(); $can_publish = true;
check( true === flxsm_apply_action( 51, 'approve' ), 'Publisher can approve' );
check( 'scheduled' === $wpdb->writes[1][1]['status'] && 1 === $kicks, 'Approved item enters the publication queue' );
$wpdb->writes = array(); $can_publish = false;
check( true === flxsm_apply_action( 51, 'schedule', array( '_system' => true ) ), 'Trusted autopost keeps its scheduled action' );
check( 'scheduled' === $wpdb->writes[1][1]['status'], 'Trusted autopost must not become a contributor draft' );
echo "Native social store contracts: OK\n";
