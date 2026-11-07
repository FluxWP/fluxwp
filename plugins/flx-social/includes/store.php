<?php
/** Kayıtlar: hesaplar, gönderiler, hedefler (gönderi × hesap). */

defined( 'ABSPATH' ) || exit;

/* ---------------- Hesaplar ---------------- */

function flxsm_account_row( $id ) {
	global $wpdb;
	return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . flxsm_table( 'accounts' ) . ' WHERE id = %d', (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB
}

/** Hesap + çözülmüş belirteç (yalnız sunucu içi kullanım). */
function flxsm_account( $id ) {
	$r = flxsm_account_row( $id );
	if ( ! $r ) {
		return null;
	}
	$r['token'] = flxsm_dec( flxsm_decrypt( $r['token'] ) );
	$r['meta']  = flxsm_dec( $r['meta'] );
	return $r;
}

function flxsm_accounts( $only_active = false ) {
	global $wpdb;
	$rows = $wpdb->get_results( 'SELECT * FROM ' . flxsm_table( 'accounts' ) . ( $only_active ? " WHERE status <> 'disabled'" : '' ) . ' ORDER BY sort ASC, id ASC', ARRAY_A ); // phpcs:ignore WordPress.DB
	return array_map( 'flxsm_account_public', (array) $rows );
}

/** API'ye giden hesap (belirteç yok). */
function flxsm_account_public( $r ) {
	$meta = is_array( $r['meta'] ) ? $r['meta'] : flxsm_dec( $r['meta'] );
	$prov = flxsm_provider( $r['provider'] );
	return array(
		'id'         => (int) $r['id'],
		'provider'   => $r['provider'],
		'via'        => $r['via'],
		'network'    => $prov ? $prov->label() : $r['provider'],
		'name'       => $r['name'],
		'username'   => $r['username'],
		'avatar'     => $r['avatar'],
		'status'     => $r['status'],
		'expires'    => (int) $r['expires'],
		'kind'       => (string) ( $meta['kind'] ?? '' ),
		'boards'     => array_values( (array) ( $meta['boards'] ?? array() ) ),
		'groups'     => array_values( (array) ( $meta['groups'] ?? array() ) ),
		'playlists'  => array_values( (array) ( $meta['playlists'] ?? array() ) ),
		'premium'    => ! empty( $meta['premium'] ),
		'last_error' => $r['last_error'],
		'caps'       => $prov ? $prov->caps( $r ) : array(),
		'created'    => (int) $r['created'],
	);
}

/**
 * Hesabı ekler ya da (aynı sağlayıcı + dış kimlik varsa) belirtecini yeniler.
 * $a: provider, via, ext_id, name, username, avatar, token (dizi), expires, meta (dizi).
 */
function flxsm_upsert_account( array $a ) {
	global $wpdb;
	$table = flxsm_table( 'accounts' );
	$now   = time();
	$data  = array(
		'provider'   => $a['provider'],
		'via'        => (string) ( $a['via'] ?? '' ),
		'ext_id'     => (string) $a['ext_id'],
		'name'       => mb_substr( (string) ( $a['name'] ?? '' ), 0, 190 ),
		'username'   => mb_substr( (string) ( $a['username'] ?? '' ), 0, 190 ),
		'avatar'     => esc_url_raw( (string) ( $a['avatar'] ?? '' ) ),
		'token'      => flxsm_encrypt( flxsm_json( (array) ( $a['token'] ?? array() ) ) ),
		'expires'    => (int) ( $a['expires'] ?? 0 ),
		'status'     => 'active',
		'meta'       => flxsm_json( (array) ( $a['meta'] ?? array() ) ),
		'last_error' => '',
		'updated'    => $now,
	);
	$id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE provider = %s AND ext_id = %s", $data['provider'], $data['ext_id'] ) ); // phpcs:ignore WordPress.DB
	if ( $id ) {
		$old  = flxsm_account( $id );
		$meta = array_merge( (array) ( $old['meta'] ?? array() ), (array) ( $a['meta'] ?? array() ) );
		$data['meta'] = flxsm_json( $meta );
		$wpdb->update( $table, $data, array( 'id' => $id ) ); // phpcs:ignore WordPress.DB
		return $id;
	}
	$data['user_id'] = get_current_user_id() ? get_current_user_id() : (int) ( $a['user_id'] ?? 0 );
	$data['created'] = $now;
	$data['sort']    = (int) $wpdb->get_var( "SELECT COALESCE(MAX(sort),0)+1 FROM {$table}" ); // phpcs:ignore WordPress.DB
	$wpdb->insert( $table, $data ); // phpcs:ignore WordPress.DB
	return (int) $wpdb->insert_id;
}

function flxsm_update_account( $id, array $patch ) {
	global $wpdb;
	if ( isset( $patch['token'] ) ) {
		$patch['token'] = flxsm_encrypt( flxsm_json( (array) $patch['token'] ) );
	}
	if ( isset( $patch['meta'] ) && is_array( $patch['meta'] ) ) {
		$patch['meta'] = flxsm_json( $patch['meta'] );
	}
	$patch['updated'] = time();
	return false !== $wpdb->update( flxsm_table( 'accounts' ), $patch, array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
}

function flxsm_account_failed( $id, $msg, $expired = false ) {
	flxsm_update_account(
		$id,
		array(
			'last_error' => mb_substr( (string) $msg, 0, 500 ),
			'status'     => $expired ? 'expired' : 'active',
		)
	);
	flxsm_log( $msg, 'error', $id );
}

function flxsm_delete_account( $id ) {
	global $wpdb;
	$id = (int) $id;
	$wpdb->query( $wpdb->prepare( 'UPDATE ' . flxsm_table( 'targets' ) . " SET status = 'cancelled', error = %s WHERE account_id = %d AND status IN ('draft','scheduled','processing')", __( 'Hesap kaldırıldı.', 'flx-social' ), $id ) ); // phpcs:ignore WordPress.DB
	$wpdb->delete( flxsm_table( 'accounts' ), array( 'id' => $id ) ); // phpcs:ignore WordPress.DB
	$wpdb->delete( flxsm_table( 'metrics' ), array( 'account_id' => $id ) ); // phpcs:ignore WordPress.DB
}

/* ---------------- Gönderiler ---------------- */

const FLXSM_POST_STATUSES = array( 'draft', 'pending', 'scheduled', 'publishing', 'published', 'partial', 'failed', 'cancelled' );

function flxsm_post_row( $id ) {
	global $wpdb;
	return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . flxsm_table( 'posts' ) . ' WHERE id = %d', (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB
}

function flxsm_targets_of( $post_id ) {
	global $wpdb;
	return (array) $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . flxsm_table( 'targets' ) . ' WHERE post_id = %d ORDER BY id ASC', (int) $post_id ), ARRAY_A ); // phpcs:ignore WordPress.DB
}

function flxsm_target_row( $id ) {
	global $wpdb;
	return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . flxsm_table( 'targets' ) . ' WHERE id = %d', (int) $id ), ARRAY_A ); // phpcs:ignore WordPress.DB
}

function flxsm_update_target( $id, array $patch ) {
	global $wpdb;
	foreach ( array( 'state', 'options', 'metrics', 'media' ) as $k ) {
		if ( isset( $patch[ $k ] ) && is_array( $patch[ $k ] ) ) {
			$patch[ $k ] = flxsm_json( $patch[ $k ] );
		}
	}
	$patch['updated'] = time();
	return false !== $wpdb->update( flxsm_table( 'targets' ), $patch, array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
}

/** Hedefin gerçekte gönderilecek metni ve medyası (hesaba özel sürüm yoksa ortak). */
function flxsm_target_payload( array $target, array $post ) {
	$text  = null !== $target['content'] ? (string) $target['content'] : (string) $post['content'];
	$media = null !== $target['media'] && '' !== $target['media'] ? flxsm_dec( $target['media'] ) : flxsm_dec( $post['media'] );
	return array(
		'text'    => $text,
		'media'   => flxsm_media_list( $media ),
		'options' => flxsm_dec( $target['options'] ),
	);
}

/** API çıktısı. $full: hedef ayrıntıları ve medya bilgileri. */
function flxsm_post_public( array $p, $full = true ) {
	$targets = flxsm_targets_of( $p['id'] );
	$accs    = array();
	foreach ( flxsm_accounts() as $a ) {
		$accs[ $a['id'] ] = $a;
	}
	$tout = array();
	foreach ( $targets as $t ) {
		$a      = $accs[ (int) $t['account_id'] ] ?? null;
		$row    = array(
			'id'           => (int) $t['id'],
			'account_id'   => (int) $t['account_id'],
			'provider'     => $a ? $a['provider'] : '',
			'account'      => $a ? $a['name'] : __( '(silinmiş hesap)', 'flx-social' ),
			'avatar'       => $a ? $a['avatar'] : '',
			'status'       => $t['status'],
			'remote_id'    => $t['remote_id'],
			'remote_url'   => $t['remote_url'],
			'error'        => $t['error'],
			'published_at' => (int) $t['published_at'],
			'metrics'      => flxsm_dec( $t['metrics'] ),
			'caps'         => $a ? $a['caps'] : array(),
		);
		if ( $full ) {
			$row['content'] = null === $t['content'] ? null : (string) $t['content'];
			$row['media']   = null === $t['media'] || '' === $t['media'] ? null : flxsm_media_public( flxsm_dec( $t['media'] ) );
			$row['options'] = (object) flxsm_dec( $t['options'] );
		}
		$tout[] = $row;
	}
	$u     = $p['user_id'] ? get_userdata( (int) $p['user_id'] ) : null;
	$names = array();
	foreach ( $tout as $trow ) {
		if ( ! empty( $trow['account'] ) ) {
			$names[] = (string) $trow['account'];
		}
	}
	$ts = (int) ( $p['scheduled_at'] ? $p['scheduled_at'] : ( $p['published_at'] ? $p['published_at'] : $p['created'] ) );
	return array(
		'id'           => (int) $p['id'],
		'status'       => $p['status'],
		'title'        => $p['title'],
		'content'      => $p['content'],
		'media'        => $full ? flxsm_media_public( flxsm_dec( $p['media'] ) ) : array_slice( flxsm_media_public( flxsm_dec( $p['media'] ) ), 0, 1 ),
		'tags'         => array_values( array_filter( array_map( 'trim', explode( ',', (string) $p['tags'] ) ) ) ),
		'scheduled_at' => (int) $p['scheduled_at'],
		'published_at' => (int) $p['published_at'],
		'repeat_days'  => (int) $p['repeat_days'],
		'source'       => $p['source'],
		'note'         => $p['note'],
		'user'         => $u ? $u->display_name : '',
		'user_id'      => (int) $p['user_id'],
		'approved_by'  => (int) $p['approved_by'],
		'created'         => (int) $p['created'],
		'updated'         => (int) $p['updated'],
		'targets'         => $tout,
		'when_label'      => ( $ts && function_exists( 'flx_date' ) ) ? flx_date( $ts, 'datetime' ) : '',
		'accounts_label'  => implode( ', ', $names ),
		'excerpt'         => mb_substr( trim( wp_strip_all_tags( (string) $p['content'] ) ), 0, 140 ),
	);
}

/**
 * Gönderi oluştur/güncelle. $d: title, content, media[], tags[], scheduled_at, repeat_days, note, source,
 * targets: [{account_id, content|null, media|null, options{}}], action: draft|submit|schedule|now.
 * Yayınlanmış hedeflere dokunulmaz (ağda düzenleme ayrı: flxsm_remote_edit).
 */
function flxsm_save_post( array $d, $id = 0 ) {
	global $wpdb;
	if ( 'approve' === ( $d['action'] ?? '' ) && ! flxsm_can_publish() && empty( $d['_system'] ) ) {
		return new WP_Error( 'rest_forbidden', __( 'Bu işlem için yetkiniz yok.', 'flx-social' ), array( 'status' => 403 ) );
	}
	$now   = time();
	$table = flxsm_table( 'posts' );
	$old   = $id ? flxsm_post_row( $id ) : null;
	if ( $id && ! $old ) {
		return new WP_Error( 'flxsm_not_found', __( 'Gönderi bulunamadı.', 'flx-social' ), array( 'status' => 404 ) );
	}
	$row = array(
		'title'       => mb_substr( sanitize_text_field( (string) ( $d['title'] ?? ( $old['title'] ?? '' ) ) ), 0, 190 ),
		'content'     => (string) ( $d['content'] ?? ( $old['content'] ?? '' ) ),
		'media'       => flxsm_json( array_values( array_filter( array_map( 'absint', (array) ( $d['media'] ?? flxsm_dec( $old['media'] ?? '' ) ) ) ) ) ),
		'tags'        => mb_substr( implode( ',', array_filter( array_map( 'sanitize_text_field', (array) ( $d['tags'] ?? explode( ',', (string) ( $old['tags'] ?? '' ) ) ) ) ) ), 0, 255 ),
		'repeat_days' => min( 365, absint( $d['repeat_days'] ?? ( $old['repeat_days'] ?? 0 ) ) ),
		'note'        => sanitize_textarea_field( (string) ( $d['note'] ?? ( $old['note'] ?? '' ) ) ),
		'updated'     => $now,
	);
	$row['content'] = str_replace( "\r\n", "\n", wp_kses( $row['content'], array() ) );
	if ( isset( $d['scheduled_at'] ) ) {
		$row['scheduled_at'] = absint( $d['scheduled_at'] );
	}
	if ( ! $id ) {
		$row['user_id'] = isset( $d['user_id'] ) ? (int) $d['user_id'] : get_current_user_id();
		$row['source']  = sanitize_key( (string) ( $d['source'] ?? 'manual' ) );
		$row['status']  = 'draft';
		$row['created'] = $now;
		$wpdb->insert( $table, $row ); // phpcs:ignore WordPress.DB
		$id = (int) $wpdb->insert_id;
	} else {
		$wpdb->update( $table, $row, array( 'id' => (int) $id ) ); // phpcs:ignore WordPress.DB
	}

	if ( isset( $d['targets'] ) ) {
		$res = flxsm_sync_targets( $id, (array) $d['targets'] );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
	}
	$action = (string) ( $d['action'] ?? '' );
	if ( '' !== $action ) {
		$r = flxsm_apply_action( $id, $action, $d );
		if ( is_wp_error( $r ) ) {
			return $r;
		}
	}
	flxsm_refresh_post_status( $id );
	return $id;
}

/** Hedefleri istenen listeyle eşitler (yayınlanmış/işlenen hedefler korunur). */
function flxsm_sync_targets( $post_id, array $list ) {
	global $wpdb;
	$table    = flxsm_table( 'targets' );
	$existing = array();
	foreach ( flxsm_targets_of( $post_id ) as $t ) {
		$existing[ (int) $t['account_id'] ] = $t;
	}
	$keep = array();
	foreach ( $list as $t ) {
		$aid = absint( $t['account_id'] ?? 0 );
		$acc = $aid ? flxsm_account_row( $aid ) : null;
		if ( ! $acc ) {
			continue;
		}
		$keep[ $aid ] = true;
		$opts         = flxsm_clean_options( (array) ( $t['options'] ?? array() ) );
		$data         = array(
			'content' => array_key_exists( 'content', $t ) && null !== $t['content'] ? str_replace( "\r\n", "\n", wp_kses( (string) $t['content'], array() ) ) : null,
			'media'   => array_key_exists( 'media', $t ) && null !== $t['media'] ? flxsm_json( array_values( array_filter( array_map( 'absint', (array) $t['media'] ) ) ) ) : null,
			'options' => flxsm_json( $opts ),
			'updated' => time(),
		);
		if ( isset( $existing[ $aid ] ) ) {
			$ex = $existing[ $aid ];
			if ( in_array( $ex['status'], array( 'published', 'processing', 'deleted' ), true ) ) {
				continue; // ağdaki gönderiye burada dokunulmaz
			}
			$wpdb->update( $table, $data, array( 'id' => (int) $ex['id'] ) ); // phpcs:ignore WordPress.DB
		} else {
			$data['post_id']    = (int) $post_id;
			$data['account_id'] = $aid;
			$data['status']     = 'draft';
			$data['remote_url'] = '';
			$data['state']      = '';
			$data['error']      = '';
			$data['metrics']    = '';
			$wpdb->insert( $table, $data ); // phpcs:ignore WordPress.DB
		}
	}
	foreach ( $existing as $aid => $ex ) {
		if ( ! isset( $keep[ $aid ] ) && in_array( $ex['status'], array( 'draft', 'scheduled', 'failed', 'cancelled' ), true ) ) {
			$wpdb->delete( $table, array( 'id' => (int) $ex['id'] ) ); // phpcs:ignore WordPress.DB
		}
	}
	return true;
}

/** Hesaba özel seçenekler: yalnız bilinen anahtarlar. */
function flxsm_clean_options( array $o ) {
	$out  = array();
	$str  = array( 'title', 'link', 'board', 'privacy', 'ig_type', 'flx_category', 'playlist', 'tiktok_privacy', 'gbp_topic', 'gbp_cta', 'gbp_cta_url', 'wa_kind', 'wa_to', 'first_comment', 'li_visibility', 'alt', 'thumb_url', 'reply_settings', 'event_title', 'event_start', 'event_end', 'offer_code' );
	$bool = array( 'made_for_kids', 'notify', 'shorts', 'disable_comment', 'disable_duet', 'disable_stitch', 'ai_generated', 'brand_content', 'brand_organic', 'share_to_feed', 'auto_music' );
	foreach ( $str as $k ) {
		if ( isset( $o[ $k ] ) && '' !== (string) $o[ $k ] ) {
			$out[ $k ] = in_array( $k, array( 'first_comment' ), true ) ? sanitize_textarea_field( (string) $o[ $k ] ) : sanitize_text_field( (string) $o[ $k ] );
		}
	}
	foreach ( $bool as $k ) {
		if ( isset( $o[ $k ] ) ) {
			$out[ $k ] = (bool) $o[ $k ];
		}
	}
	if ( isset( $o['tags'] ) ) {
		$out['tags'] = array_values( array_filter( array_map( 'sanitize_text_field', (array) $o['tags'] ) ) );
	}
	return $out;
}

/**
 * Durum geçişi: draft (taslak), submit (onaya gönder), schedule (zamanla), now (hemen paylaş), cancel, approve.
 */
function flxsm_apply_action( $post_id, $action, array $d = array() ) {
	global $wpdb;
	$p = flxsm_post_row( $post_id );
	if ( ! $p ) {
		return new WP_Error( 'flxsm_not_found', __( 'Gönderi bulunamadı.', 'flx-social' ), array( 'status' => 404 ) );
	}
	$table   = flxsm_table( 'targets' );
	$open    = "('draft','scheduled','failed','cancelled')";
	$targets = flxsm_targets_of( $post_id );
	if ( in_array( $action, array( 'schedule', 'now', 'submit', 'approve' ), true ) && ! array_filter( $targets, fn( $t ) => in_array( $t['status'], array( 'draft', 'scheduled', 'failed', 'cancelled' ), true ) ) ) {
		return new WP_Error( 'flxsm_no_target', __( 'En az bir hesap seçin.', 'flx-social' ), array( 'status' => 400 ) );
	}
	$can_publish = flxsm_can_publish() || ! empty( $d['_system'] );
	if ( 'approve' === $action && ! $can_publish ) {
		return new WP_Error( 'rest_forbidden', __( 'Bu işlem için yetkiniz yok.', 'flx-social' ), array( 'status' => 403 ) );
	}
	if ( in_array( $action, array( 'schedule', 'now' ), true ) && ! $can_publish ) {
		$action = 'submit'; // yetkisi yoksa onaya düşer
	}
	if ( in_array( $action, array( 'schedule', 'now', 'approve' ), true ) ) {
		$err = flxsm_validate_post( $post_id );
		if ( is_wp_error( $err ) ) {
			return $err;
		}
	}
	$now = time();
	switch ( $action ) {
		case 'draft':
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'draft', next_at = 0 WHERE post_id = %d AND status IN {$open}", $post_id ) ); // phpcs:ignore WordPress.DB
			$wpdb->update( flxsm_table( 'posts' ), array( 'status' => 'draft' ), array( 'id' => $post_id ) ); // phpcs:ignore WordPress.DB
			break;
		case 'submit':
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'draft', next_at = 0 WHERE post_id = %d AND status IN {$open}", $post_id ) ); // phpcs:ignore WordPress.DB
			$wpdb->update( flxsm_table( 'posts' ), array( 'status' => 'pending' ), array( 'id' => $post_id ) ); // phpcs:ignore WordPress.DB
			do_action( 'flxsm_post_submitted', $post_id );
			break;
		case 'approve':
		case 'schedule':
		case 'now':
			$when = 'now' === $action ? $now : max( $now, (int) ( $p['scheduled_at'] ? $p['scheduled_at'] : $now ) );
			if ( 'approve' === $action && (int) $p['scheduled_at'] <= $now ) {
				$when = $now;
			}
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'scheduled', next_at = %d, attempts = 0, error = '', state = '' WHERE post_id = %d AND status IN {$open}", $when, $post_id ) ); // phpcs:ignore WordPress.DB
			$upd = array(
				'status'       => 'scheduled',
				'scheduled_at' => $when,
			);
			if ( 'approve' === $action || 'pending' === $p['status'] ) {
				$upd['approved_by'] = get_current_user_id();
			}
			$wpdb->update( flxsm_table( 'posts' ), $upd, array( 'id' => $post_id ) ); // phpcs:ignore WordPress.DB
			if ( $when <= $now + 60 ) {
				flxsm_kick();
			}
			break;
		case 'cancel':
			$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'cancelled', next_at = 0 WHERE post_id = %d AND status IN ('draft','scheduled')", $post_id ) ); // phpcs:ignore WordPress.DB
			break;
		default:
			return new WP_Error( 'flxsm_action', __( 'Bilinmeyen işlem.', 'flx-social' ), array( 'status' => 400 ) );
	}
	return true;
}

/** Yayın öncesi doğrulama: her hedef için sağlayıcı kuralları. */
function flxsm_validate_post( $post_id ) {
	$p    = flxsm_post_row( $post_id );
	$errs = array();
	foreach ( flxsm_targets_of( $post_id ) as $t ) {
		if ( ! in_array( $t['status'], array( 'draft', 'scheduled', 'failed', 'cancelled' ), true ) ) {
			continue;
		}
		$acc  = flxsm_account_row( $t['account_id'] );
		$prov = $acc ? flxsm_provider( $acc['provider'] ) : null;
		if ( ! $prov ) {
			continue;
		}
		if ( 'expired' === $acc['status'] ) {
			/* translators: %s: account name */
			$errs[] = sprintf( __( '%s: bağlantının süresi dolmuş, Hesaplar’dan yeniden bağlayın.', 'flx-social' ), $acc['name'] );
			continue;
		}
		$pl = flxsm_target_payload( $t, $p );
		foreach ( $prov->validate( $pl, $acc ) as $e ) {
			$errs[] = $acc['name'] . ': ' . $e;
		}
	}
	if ( $errs ) {
		return new WP_Error( 'flxsm_invalid', implode( "\n", $errs ), array( 'status' => 400, 'errors' => $errs ) );
	}
	return true;
}

/** Hedef durumlarından gönderi durumu. */
function flxsm_refresh_post_status( $post_id ) {
	global $wpdb;
	$p = flxsm_post_row( $post_id );
	if ( ! $p ) {
		return;
	}
	$c = array();
	foreach ( flxsm_targets_of( $post_id ) as $t ) {
		$c[ $t['status'] ] = ( $c[ $t['status'] ] ?? 0 ) + 1;
	}
	$total = array_sum( $c );
	$st    = $p['status'];
	if ( ! $total ) {
		$st = 'pending' === $p['status'] ? 'pending' : 'draft';
	} elseif ( ! empty( $c['processing'] ) ) {
		$st = 'publishing';
	} elseif ( ! empty( $c['scheduled'] ) ) {
		$st = ! empty( $c['published'] ) || ! empty( $c['failed'] ) ? 'publishing' : 'scheduled';
	} elseif ( ( $c['published'] ?? 0 ) + ( $c['deleted'] ?? 0 ) === $total ) {
		$st = 'published';
	} elseif ( ! empty( $c['published'] ) ) {
		$st = 'partial';
	} elseif ( ! empty( $c['failed'] ) ) {
		$st = 'failed';
	} elseif ( ( $c['cancelled'] ?? 0 ) === $total ) {
		$st = 'cancelled';
	} elseif ( 'pending' !== $p['status'] ) {
		$st = 'draft';
	}
	$upd = array( 'status' => $st );
	if ( in_array( $st, array( 'published', 'partial' ), true ) && ! (int) $p['published_at'] ) {
		$upd['published_at'] = time();
	}
	if ( $st !== $p['status'] || isset( $upd['published_at'] ) ) {
		$wpdb->update( flxsm_table( 'posts' ), $upd, array( 'id' => (int) $post_id ) ); // phpcs:ignore WordPress.DB
		if ( $st !== $p['status'] ) {
			do_action( 'flxsm_post_status', (int) $post_id, $st, $p['status'] );
		}
	}
}

/** Gönderiyi yerelden siler; $remote = ağdan da sil (destekleyen hedefler). Dönüş: ağdan silinemeyenler. */
function flxsm_delete_post( $post_id, $remote = false ) {
	global $wpdb;
	$left = array();
	foreach ( flxsm_targets_of( $post_id ) as $t ) {
		if ( 'published' === $t['status'] && $remote ) {
			$r = flxsm_remote_delete( (int) $t['id'] );
			if ( is_wp_error( $r ) ) {
				$left[] = $r->get_error_message();
			}
		}
	}
	if ( $left && $remote ) {
		return $left;
	}
	$wpdb->delete( flxsm_table( 'targets' ), array( 'post_id' => (int) $post_id ) ); // phpcs:ignore WordPress.DB
	$wpdb->delete( flxsm_table( 'posts' ), array( 'id' => (int) $post_id ) ); // phpcs:ignore WordPress.DB
	return array();
}

/** Listeleme: status, account, provider, q, from, to (UTC), page, per. */
function flxsm_query_posts( array $f ) {
	global $wpdb;
	$pt    = flxsm_table( 'posts' );
	$tt    = flxsm_table( 'targets' );
	$at    = flxsm_table( 'accounts' );
	$where = array( '1=1' );
	$args  = array();
	if ( ! empty( $f['status'] ) ) {
		$st = array_intersect( (array) ( is_array( $f['status'] ) ? $f['status'] : explode( ',', $f['status'] ) ), FLXSM_POST_STATUSES );
		if ( $st ) {
			$where[] = 'p.status IN (' . implode( ',', array_fill( 0, count( $st ), '%s' ) ) . ')';
			$args    = array_merge( $args, array_values( $st ) );
		}
	}
	if ( ! empty( $f['account'] ) ) {
		$where[] = "EXISTS (SELECT 1 FROM {$tt} t WHERE t.post_id = p.id AND t.account_id = %d)";
		$args[]  = (int) $f['account'];
	}
	if ( ! empty( $f['provider'] ) ) {
		$where[] = "EXISTS (SELECT 1 FROM {$tt} t JOIN {$at} a ON a.id = t.account_id WHERE t.post_id = p.id AND a.provider = %s)";
		$args[]  = sanitize_key( $f['provider'] );
	}
	if ( ! empty( $f['q'] ) ) {
		$like    = '%' . $wpdb->esc_like( (string) $f['q'] ) . '%';
		$where[] = '(p.title LIKE %s OR p.content LIKE %s OR p.tags LIKE %s)';
		array_push( $args, $like, $like, $like );
	}
	if ( ! empty( $f['tag'] ) ) {
		$where[] = 'p.tags LIKE %s';
		$args[]  = '%' . $wpdb->esc_like( (string) $f['tag'] ) . '%';
	}
	if ( ! empty( $f['mine'] ) ) {
		$where[] = 'p.user_id = %d';
		$args[]  = get_current_user_id();
	}
	$timecol = 'COALESCE(NULLIF(p.published_at,0), NULLIF(p.scheduled_at,0), p.created)';
	if ( ! empty( $f['from'] ) ) {
		$where[] = "{$timecol} >= %d";
		$args[]  = (int) $f['from'];
	}
	if ( ! empty( $f['to'] ) ) {
		$where[] = "{$timecol} < %d";
		$args[]  = (int) $f['to'];
	}
	$w     = implode( ' AND ', $where );
	$per   = max( 1, min( 200, (int) ( $f['per'] ?? 30 ) ) );
	$page  = max( 1, (int) ( $f['page'] ?? 1 ) );
	$order = ! empty( $f['asc'] ) ? 'ASC' : 'DESC';
	$sqlc  = "SELECT COUNT(*) FROM {$pt} p WHERE {$w}";
	$sql   = "SELECT p.* FROM {$pt} p WHERE {$w} ORDER BY {$timecol} {$order}, p.id {$order} LIMIT %d OFFSET %d";
	$total = (int) ( $args ? $wpdb->get_var( $wpdb->prepare( $sqlc, $args ) ) : $wpdb->get_var( $sqlc ) ); // phpcs:ignore WordPress.DB
	$rows  = $wpdb->get_results( $wpdb->prepare( $sql, array_merge( $args, array( $per, ( $page - 1 ) * $per ) ) ), ARRAY_A ); // phpcs:ignore WordPress.DB
	return array(
		'total' => $total,
		'page'  => $page,
		'pages' => (int) ceil( $total / $per ),
		'per'   => $per,
		'items' => array_map( fn( $r ) => flxsm_post_public( $r, ! empty( $f['full'] ) ), (array) $rows ),
	);
}
