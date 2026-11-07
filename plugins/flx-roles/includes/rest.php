<?php
/** Native administration contract. Every write uses the same role helpers as the WordPress panel. */
defined( 'ABSPATH' ) || exit;

function flxr_rest_can() {
	return current_user_can( 'manage_options' );
}

function flxr_rest_people_can() {
	return flxr_rest_can() && current_user_can( 'list_users' );
}

function flxr_rest_promote_can() {
	return flxr_rest_can() && current_user_can( 'promote_users' );
}

function flxr_rest_error( $message, $status = 400 ) {
	return new WP_Error( 'flxr_invalid', $message, array( 'status' => $status ) );
}

function flxr_rest_matrix() {
	$roles = array();
	$groups = array();
	$counts = count_users();
	foreach ( flxr_catalog() as $id => $group ) {
		$caps = array();
		foreach ( $group['caps'] as $cap => $info ) {
			$caps[] = array( 'id' => $cap, 'label' => $info['label'], 'locked' => ! empty( $info['locked'] ), 'supported' => flxr_cap_supported( $cap ), 'warning' => ! empty( $info['warn'] ) );
		}
		$groups[] = array( 'id' => $id, 'label' => $group['label'], 'active' => ! empty( $group['active'] ), 'plugin' => $group['plugin'] ?? '', 'caps' => $caps );
	}
	foreach ( flxr_roles() as $id => $role ) {
		if ( 'administrator' === $id || ! get_role( $id ) ) { continue; }
		$caps = array();
		foreach ( $groups as $group ) { foreach ( $group['caps'] as $cap ) { $caps[ $cap['id'] ] = flxr_role_has( $id, $cap['id'] ); } }
		$roles[] = array( 'id' => $id, 'label' => $role['label'], 'description' => $role['desc'] ?? '', 'custom' => ! empty( $role['custom'] ), 'count' => (int) ( $counts['avail_roles'][ $id ] ?? 0 ), 'caps' => $caps );
	}
	$choices = array();
	foreach ( flxr_home_choices() as $id => $choice ) { $choices[] = array( 'id' => $id, 'label' => $choice[0] ); }
	$settings = flxr_settings();
	$version_roles = array_map( function ( $r ) { return array( 'id' => $r['id'], 'caps' => $r['caps'] ); }, $roles );
	return array( 'roles' => $roles, 'groups' => $groups, 'settings' => $settings, 'home_choices' => $choices, 'can_promote' => flxr_rest_promote_can(), 'can_list' => current_user_can( 'list_users' ), 'version' => hash( 'sha256', wp_json_encode( array( $version_roles, $settings, $groups ) ) ) );
}

/** Validate the entire patch before touching any capability or option. */
function flxr_rest_save_matrix( WP_REST_Request $request ) {
	$in = (array) $request->get_json_params();
	$current = flxr_rest_matrix();
	if ( ! isset( $in['version'] ) || ! is_string( $in['version'] ) || ! hash_equals( $current['version'], $in['version'] ) ) {
		return flxr_rest_error( __( 'Ayarlar başka bir yerde değişti. Yenileyip değişikliklerinizi tekrar uygulayın.', 'flx-roles' ), 409 );
	}
	$roles = array_column( $current['roles'], null, 'id' );
	$catalog = array();
	foreach ( $current['groups'] as $group ) { foreach ( $group['caps'] as $cap ) { $catalog[ $cap['id'] ] = $cap; } }
	if ( ! isset( $in['caps'] ) || ! is_array( $in['caps'] ) || ( isset( $in['home'] ) && ! is_array( $in['home'] ) ) ) { return flxr_rest_error( __( 'Geçersiz yetki tablosu.', 'flx-roles' ) ); }
	foreach ( $in['caps'] as $role => $caps ) {
		if ( ! isset( $roles[ $role ] ) || ! is_array( $caps ) ) { return flxr_rest_error( __( 'Rol bulunamadı.', 'flx-roles' ) ); }
		foreach ( $caps as $cap => $on ) {
			if ( ! isset( $catalog[ $cap ] ) || ! is_bool( $on ) ) { return flxr_rest_error( __( 'Geçersiz yetki.', 'flx-roles' ) ); }
			if ( $catalog[ $cap ]['locked'] && $on !== $roles[ $role ]['caps'][ $cap ] ) { return flxr_rest_error( __( 'Bu yetki değiştirilemez.', 'flx-roles' ) ); }
		}
	}
	$choices = array_column( $current['home_choices'], 'id' );
	foreach ( (array) ( $in['home'] ?? array() ) as $role => $home ) {
		if ( ! isset( $roles[ $role ] ) || ! is_string( $home ) || ! in_array( $home, $choices, true ) ) { return flxr_rest_error( __( 'Geçersiz açılış ekranı.', 'flx-roles' ) ); }
	}
	if ( isset( $in['ref_days'] ) && ( ! is_int( $in['ref_days'] ) || $in['ref_days'] < 1 || $in['ref_days'] > 365 ) ) { return flxr_rest_error( __( 'Süre 1-365 gün olmalı.', 'flx-roles' ) ); }
	foreach ( $in['caps'] as $role => $caps ) { foreach ( $caps as $cap => $on ) { if ( ! $catalog[ $cap ]['locked'] ) { flxr_set_role_cap( $role, $cap, $on ); } } }
	$settings = flxr_settings();
	foreach ( (array) ( $in['home'] ?? array() ) as $role => $home ) { $settings['home'][ $role ] = $home; }
	if ( isset( $in['ref_days'] ) ) { $settings['ref_days'] = $in['ref_days']; }
	update_option( 'flxr_settings', $settings, false );
	return flxr_rest_matrix();
}

function flxr_rest_role( WP_REST_Request $request ) {
	$role = (string) $request['role'];
	if ( 'administrator' === $role || ! isset( flxr_roles()[ $role ] ) ) { return flxr_rest_error( __( 'Rol bulunamadı.', 'flx-roles' ), 404 ); }
	if ( 'reset' === $request['operation'] ) { flxr_reset_role( $role ); }
	elseif ( ! flxr_delete_custom_role( $role ) ) { return flxr_rest_error( __( 'Yalnız eklediğiniz roller silinebilir.', 'flx-roles' ) ); }
	return flxr_rest_matrix();
}

function flxr_rest_people( WP_REST_Request $request ) {
	$role = (string) $request->get_param( 'role' );
	if ( 'administrator' === $role || ! isset( flxr_roles()[ $role ] ) ) { return flxr_rest_error( __( 'Rol bulunamadı.', 'flx-roles' ), 404 ); }
	$per = max( 1, min( 100, (int) ( $request->get_param( 'per_page' ) ?: 25 ) ) );
	$page = max( 1, (int) $request->get_param( 'page' ) );
	$args = array( 'role' => $role, 'number' => $per, 'offset' => ( $page - 1 ) * $per, 'orderby' => 'display_name', 'order' => 'ASC' );
	$q = sanitize_text_field( (string) $request->get_param( 'search' ) );
	if ( '' !== $q ) { $args['search'] = '*' . $q . '*'; $args['search_columns'] = array( 'user_login', 'user_email', 'display_name' ); }
	$query = new WP_User_Query( $args );
	$items = array();
	foreach ( $query->get_results() as $user ) {
		$items[] = array( 'id' => (int) $user->ID, 'name' => $user->display_name, 'login' => $user->user_login, 'email' => $user->user_email, 'phone' => flxr_user_phone( $user->ID ), 'protected' => user_can( $user, 'manage_options' ), 'referral' => user_can( $user, FLXR_CAP_REF ) );
	}
	return array( 'items' => $items, 'total' => (int) $query->get_total(), 'page' => $page, 'pages' => max( 1, (int) ceil( $query->get_total() / $per ) ) );
}

function flxr_rest_member( WP_REST_Request $request ) {
	$role = (string) $request->get_param( 'role' );
	if ( 'administrator' === $role || ! isset( flxr_roles()[ $role ] ) ) { return flxr_rest_error( __( 'Rol bulunamadı.', 'flx-roles' ), 404 ); }
	$operation = $request->get_param( 'operation' );
	if ( ! in_array( $operation, array( 'add', 'remove' ), true ) ) { return flxr_rest_error( __( 'Geçersiz işlem.', 'flx-roles' ) ); }
	if ( 'remove' === $operation ) { $user = get_userdata( (int) $request->get_param( 'user' ) ); }
	else {
		$who = sanitize_text_field( (string) $request->get_param( 'who' ) );
		$user = is_email( $who ) ? get_user_by( 'email', $who ) : get_user_by( 'login', $who );
	}
	if ( ! $user ) { return flxr_rest_error( __( 'Kullanıcı bulunamadı. Önce kullanıcıyı oluşturun.', 'flx-roles' ), 404 ); }
	if ( user_can( $user, 'manage_options' ) || ! current_user_can( 'edit_user', $user->ID ) ) { return flxr_rest_error( __( 'Bu kullanıcının rolü değiştirilemez.', 'flx-roles' ), 403 ); }
	if ( 'remove' === $operation ) {
		$user->remove_role( $role );
		if ( ! $user->roles ) { $user->add_role( (string) get_option( 'default_role', 'subscriber' ) ); }
	} else {
		foreach ( array_unique( array_merge( array_keys( flxr_roles() ), array( 'subscriber', 'customer' ) ) ) as $other ) { if ( $other !== $role ) { $user->remove_role( $other ); } }
		$user->add_role( $role );
	}
	return array( 'ok' => true );
}

add_action( 'rest_api_init', function () {
	$register = function ( $path, $method, $callback, $permission = 'flxr_rest_can' ) {
		register_rest_route( 'flx-roles/v1', $path, array( 'methods' => $method, 'callback' => $callback, 'permission_callback' => $permission ) );
	};
	$register( '/matrix', 'GET', 'flxr_rest_matrix' );
	$register( '/matrix', 'POST', 'flxr_rest_save_matrix' );
	$register( '/roles', 'POST', function ( WP_REST_Request $r ) {
		$result = flxr_add_custom_role( (string) $r->get_param( 'name' ) );
		return is_wp_error( $result ) ? flxr_rest_error( $result->get_error_message() ) : flxr_rest_matrix();
	} );
	$register( '/roles/(?P<role>[a-z0-9_-]+)/(?P<operation>reset|delete)', 'POST', 'flxr_rest_role' );
	$register( '/people', 'GET', 'flxr_rest_people', 'flxr_rest_people_can' );
	$register( '/people', 'POST', 'flxr_rest_member', 'flxr_rest_promote_can' );
	$register( '/people/(?P<id>\d+)/phone', 'POST', function ( WP_REST_Request $r ) {
		$id = (int) $r['id'];
		if ( ! get_userdata( $id ) || ! current_user_can( 'edit_user', $id ) ) { return flxr_rest_error( __( 'Bu kullanıcı düzenlenemez.', 'flx-roles' ), 403 ); }
		$result = flxr_set_user_phone( $id, (string) $r->get_param( 'phone' ) );
		return is_wp_error( $result ) ? flxr_rest_error( $result->get_error_message() ) : array( 'phone' => flxr_user_phone( $id ) );
	} );
	$register( '/people/(?P<id>\d+)/referral', 'POST', function ( WP_REST_Request $r ) {
		$id = (int) $r['id'];
		$user = get_userdata( $id );
		if ( ! $user || ! current_user_can( 'edit_user', $id ) || ! user_can( $user, FLXR_CAP_REF ) ) { return flxr_rest_error( __( 'Bu kullanıcı için referans bağlantısı oluşturulamaz.', 'flx-roles' ), 403 ); }
		return array( 'url' => flxr_ref_link( $id ) );
	} );
} );

add_filter( 'rest_post_dispatch', function ( $response, $server, $request ) {
	if ( 0 === strpos( $request->get_route(), '/flx-roles/v1/' ) && $response instanceof WP_REST_Response ) {
		$response->header( 'Cache-Control', 'private, no-store, max-age=0' );
		$response->header( 'CDN-Cache-Control', 'no-store' );
		$response->header( 'X-LiteSpeed-Cache-Control', 'no-cache' );
	}
	return $response;
}, 10, 3 );
