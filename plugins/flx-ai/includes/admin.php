<?php
/**
 * Yönetim ekranları: Genel bakış (raporlar), Kayıtlar, Bağlı sistemler, Faturalandırma, Araçlar, MCP, Ayarlar.
 *
 * @package FLX_AI
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_menu', 'flxai_admin_menu' );

function flxai_admin_menu() {
	add_menu_page( 'Flux AI & MCP', 'Flux AI & MCP', 'manage_options', 'flx-ai', 'flxai_page_overview', 'none', 59 );
	add_submenu_page( 'flx-ai', __( 'Genel bakış', 'flx-ai' ), __( 'Genel bakış', 'flx-ai' ), 'manage_options', 'flx-ai', 'flxai_page_overview' );
	add_submenu_page( 'flx-ai', __( 'Kayıtlar', 'flx-ai' ), __( 'Kayıtlar', 'flx-ai' ), 'manage_options', 'flx-ai-log', 'flxai_page_log' );
	add_submenu_page( 'flx-ai', __( 'Bağlı sistemler', 'flx-ai' ), __( 'Bağlı sistemler', 'flx-ai' ), 'manage_options', 'flx-ai-systems', 'flxai_page_systems' );
	add_submenu_page( 'flx-ai', __( 'Faturalandırma', 'flx-ai' ), __( 'Faturalandırma', 'flx-ai' ), 'manage_options', 'flx-ai-billing', 'flxai_page_billing' );
	add_submenu_page( 'flx-ai', __( 'Araçlar', 'flx-ai' ), __( 'Araçlar', 'flx-ai' ), 'manage_options', 'flx-ai-tools', 'flxai_page_tools' );
	add_submenu_page( 'flx-ai', 'MCP', 'MCP', 'manage_options', 'flx-ai-mcp', 'flxai_page_mcp' );
	add_submenu_page( 'flx-ai', __( 'Ayarlar', 'flx-ai' ), __( 'Ayarlar', 'flx-ai' ), 'manage_options', 'flx-ai-settings', 'flxai_page_settings' );
}

/** Flux Admin alt bar / komut paleti çizgi simgesi. */
add_filter(
	'flxa_menu_icons',
	function ( $m ) {
		$m['flx-ai'] = 'bolt';
		return $m;
	}
);

add_action(
	'admin_head',
	function () {
		// Flux Admin kuruluysa menü logosunu o verir (boyut ve Degrade/Pastel stili diğer paketlerle aynı).
		if ( function_exists( 'flxa_logo_file_url' ) ) {
			return;
		}
		$u = esc_url( FLXAI_URL . 'assets/icon.svg?ver=' . FLXAI_VERSION );
		echo '<style>#adminmenu #toplevel_page_flx-ai div.wp-menu-image,body #adminmenu li#toplevel_page_flx-ai.flxa-letter div.wp-menu-image{background:url(' . $u . ') center/20px 20px no-repeat!important}#adminmenu #toplevel_page_flx-ai div.wp-menu-image::before{content:none!important}</style>';
	}
);

add_action(
	'admin_enqueue_scripts',
	function ( $hook ) {
		if ( false === strpos( (string) $hook, 'flx-ai' ) ) {
			return;
		}
		wp_enqueue_style( 'flxai-admin', FLXAI_URL . 'assets/css/admin.css', array(), FLXAI_VERSION );
		wp_enqueue_script( 'flxai-admin', FLXAI_URL . 'assets/js/admin.js', array(), FLXAI_VERSION, true );
		wp_localize_script(
			'flxai-admin',
			'FLXAI_ADMIN',
			array(
				'rest'   => esc_url_raw( rest_url( 'flx-ai/v1/' ) ),
				'nonce'  => wp_create_nonce( 'wp_rest' ),
				'locale' => str_replace( '_', '-', determine_locale() ),
				'i18n'   => flxai_js_strings(),
			)
		);
		if ( false !== strpos( (string) $hook, 'flx-ai-settings' ) ) {
			flxai_enqueue_model_picker();
		}
	}
);

/** Uygulama ekranı listesine (Flux Admin) eklenmez; normal wp-admin sayfaları. */
function flxai_page_head( $title, $sub = '' ) {
	echo '<div class="wrap flxai"><div class="flxai-head"><img src="' . esc_url( FLXAI_URL . 'assets/icon.svg' ) . '" alt="" width="36" height="36"><div><h1>' . esc_html( $title ) . '</h1>';
	if ( '' !== $sub ) {
		echo '<p class="flxai-sub">' . esc_html( $sub ) . '</p>';
	}
	echo '</div></div>';
}

function flxai_kpi( $label, $value, $sub = '', $pct = null, $over = false ) {
	echo '<div class="flxai-kpi' . ( $over ? ' is-over' : '' ) . '"><span class="flxai-kpi-l">' . esc_html( $label ) . '</span><strong>' . esc_html( $value ) . '</strong>';
	if ( null !== $pct ) {
		echo '<span class="flxai-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' . esc_attr( min( 100, $pct ) ) . '"><span style="width:' . esc_attr( min( 100, $pct ) ) . '%"></span></span>';
	}
	if ( '' !== $sub ) {
		echo '<span class="flxai-kpi-s">' . esc_html( $sub ) . '</span>';
	}
	echo '</div>';
}

/** Sınır kartları (bugün, hafta, ay). */
function flxai_budget_cards() {
	echo '<div class="flxai-kpis">';
	foreach ( flxai_budget_status() as $row ) {
		$sub = $row['limit'] > 0
			/* translators: 1: limit, 2: reset date */
			? sprintf( __( 'Sınır %1$s · %2$s yenilenir', 'flx-ai' ), flxai_usd( $row['limit'], 2 ), flx_date( $row['resets'], 'j M H:i' ) )
			: __( 'Sınır yok', 'flx-ai' );
		flxai_kpi( $row['label'], flxai_usd( $row['spent'] ), $sub, $row['limit'] > 0 ? $row['pct'] : null, $row['over'] );
	}
	echo '</div>';
}

/* ---------------------------------------------------------------------------
 * Genel bakış
 * ------------------------------------------------------------------------- */

function flxai_page_overview() {
	if ( 'log' === sanitize_key( $_GET['tab'] ?? '' ) ) { // phpcs:ignore -- eski bağlantılar
		flxai_page_log();
		return;
	}
	flxai_page_head( 'Flux AI', __( 'Tüm eklentilerin yapay zekâ kullanımı: maliyet, süre, önbellek ve araçlar.', 'flx-ai' ) );
	$days   = (int) ( $_GET['days'] ?? 30 ); // phpcs:ignore
	$days   = in_array( $days, array( 7, 14, 30, 90, 180 ), true ) ? $days : 30;
	$source = sanitize_key( $_GET['source'] ?? '' ); // phpcs:ignore
	$rep    = flxai_report( $days, $source );
	$t      = $rep['totals'];

	if ( ! flxai_providers_ready() ) {
		echo '<div class="notice notice-warning inline"><p>' . esc_html__( 'Henüz API anahtarı girilmedi.', 'flx-ai' ) . ' <a href="' . esc_url( admin_url( 'admin.php?page=flx-ai-settings' ) ) . '">' . esc_html__( 'Ayarlar', 'flx-ai' ) . '</a></p></div>';
	}
	flxai_budget_cards();

	// Süzgeçler tek satırda.
	echo '<form class="flxai-filters" method="get"><input type="hidden" name="page" value="flx-ai"><div class="flxai-seg">';
	foreach ( array( 7, 30, 90, 180 ) as $d ) {
		/* translators: %d: days */
		printf( '<button type="submit" name="days" value="%1$d" class="%2$s">%3$s</button>', (int) $d, $d === $days ? 'is-on' : '', esc_html( sprintf( __( '%d gün', 'flx-ai' ), $d ) ) );
	}
	echo '</div><label><span class="screen-reader-text">' . esc_html__( 'Kaynak', 'flx-ai' ) . '</span><select name="source" onchange="this.form.submit()"><option value="">' . esc_html__( 'Tüm eklentiler', 'flx-ai' ) . '</option>';
	foreach ( flxai_sources() as $id => $label ) {
		printf( '<option value="%s"%s>%s</option>', esc_attr( $id ), selected( $source, $id, false ), esc_html( $label ) );
	}
	echo '</select></label><input type="hidden" name="days" value="' . esc_attr( $days ) . '"></form>';

	echo '<div class="flxai-kpis">';
	flxai_kpi( __( 'Maliyet', 'flx-ai' ), flxai_usd( $t['cost'] ), sprintf( /* translators: %s: amount */ __( 'Önbellek tasarrufu %s', 'flx-ai' ), flxai_usd( $t['saved'] ) ) );
	flxai_kpi( __( 'Model istekleri', 'flx-ai' ), number_format_i18n( $t['calls'] ), sprintf( /* translators: %s: count */ __( '%s araç çağrısı', 'flx-ai' ), number_format_i18n( $t['tools'] ) ) );
	flxai_kpi( __( 'Token', 'flx-ai' ), number_format_i18n( $t['in_tok'] + $t['out_tok'] ), sprintf( /* translators: 1: in, 2: out, 3: cached */ __( 'Giriş %1$s · çıkış %2$s · önbellekten %3$s', 'flx-ai' ), number_format_i18n( $t['in_tok'] ), number_format_i18n( $t['out_tok'] ), number_format_i18n( $t['cr'] ) ) );
	$tot_ms = max( 1, $t['model_ms'] + $t['tool_ms'] );
	flxai_kpi( __( 'Toplam süre', 'flx-ai' ), flxai_ms( $tot_ms ), sprintf( /* translators: 1: percent model, 2: percent tools */ __( 'Model/düşünme %%%1$s · araçlar %%%2$s', 'flx-ai' ), number_format_i18n( $t['model_ms'] / $tot_ms * 100, 0 ), number_format_i18n( $t['tool_ms'] / $tot_ms * 100, 0 ) ) );
	flxai_kpi( __( 'Hata', 'flx-ai' ), number_format_i18n( $t['errors'] ), $t['calls'] ? sprintf( /* translators: %s: percent */ __( 'İsteklerin %%%s', 'flx-ai' ), number_format_i18n( $t['errors'] / max( 1, $t['calls'] + $t['tools'] ) * 100, 1 ) ) : '' );
	echo '</div>';

	$chart = array(
		'daily' => $rep['daily'],
		'tools' => array_map(
			function ( $r ) {
				return array( 'label' => $r['label'], 'avg' => (int) $r['avg_ms'], 'max' => (int) $r['max_ms'], 'n' => (int) $r['n'], 'err' => (int) $r['errors'] );
			},
			array_slice( $rep['by_tool'], 0, 16 )
		),
	);
	echo '<div class="flxai-grid">';
	echo '<section class="flxai-card flxai-span2"><h2>' . esc_html__( 'Günlük maliyet (USD)', 'flx-ai' ) . '</h2><div class="flxai-chart" data-chart="cost"></div></section>';
	echo '<section class="flxai-card flxai-span2"><h2>' . esc_html__( 'Süre nereye gidiyor: model/düşünme ve araçlar', 'flx-ai' ) . '</h2><div class="flxai-chart" data-chart="time"></div></section>';
	echo '<section class="flxai-card"><h2>' . esc_html__( 'Günlük token', 'flx-ai' ) . '</h2><div class="flxai-chart" data-chart="tokens"></div></section>';
	echo '<section class="flxai-card"><h2>' . esc_html__( 'Araç başına ortalama süre', 'flx-ai' ) . '</h2><div class="flxai-chart" data-chart="tools"></div></section>';
	echo '</div>';
	echo '<script type="application/json" id="flxai-chart-data">' . wp_json_encode( $chart ) . '</script>';

	echo '<div class="flxai-grid">';
	flxai_breakdown_table( __( 'Eklentiye göre', 'flx-ai' ), $rep['by_source'] );
	flxai_breakdown_table( __( 'Modele göre', 'flx-ai' ), $rep['by_model'] );
	echo '</div>';
	flxai_breakdown_table( __( 'Amaca göre', 'flx-ai' ), $rep['by_purpose'] );
	echo '</div>';
}

/** Döküm tablosu (eklenti/model/amaç). */
function flxai_breakdown_table( $title, $rows, $raw_label = false ) {
	echo '<section class="flxai-card"><h2>' . esc_html( $title ) . '</h2>';
	if ( ! $rows ) {
		echo '<p class="flxai-empty">' . esc_html__( 'Bu aralıkta kayıt yok.', 'flx-ai' ) . '</p></section>';
		return;
	}
	echo '<div class="flxai-tscroll"><table class="flxai-table"><thead><tr><th>' . esc_html__( 'Ad', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'İstek', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Token', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Model süresi', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Araç süresi', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Maliyet', 'flx-ai' ) . '</th></tr></thead><tbody>';
	foreach ( $rows as $r ) {
		$label = $raw_label ? (string) $r['k'] : (string) ( $r['label'] ?? $r['k'] );
		printf(
			'<tr><td>%1$s%7$s</td><td class="num">%2$s</td><td class="num">%3$s</td><td class="num">%4$s</td><td class="num">%5$s</td><td class="num"><strong>%6$s</strong></td></tr>',
			esc_html( '' !== $label ? $label : '—' ),
			esc_html( number_format_i18n( (int) $r['calls'] ) . ( (int) $r['tools'] ? ' + ' . number_format_i18n( (int) $r['tools'] ) : '' ) ),
			esc_html( number_format_i18n( (int) $r['in_tok'] + (int) $r['out_tok'] ) ),
			esc_html( flxai_ms( (int) $r['model_ms'] ) ),
			esc_html( flxai_ms( (int) $r['tool_ms'] ) ),
			esc_html( flxai_usd( (float) $r['cost'] ) ),
			(int) $r['errors'] ? ' <span class="flxai-pill is-err">' . esc_html( sprintf( /* translators: %s: count */ __( '%s hata', 'flx-ai' ), number_format_i18n( (int) $r['errors'] ) ) ) . '</span>' : ''
		);
	}
	echo '</tbody></table></div></section>';
}

/* ---------------------------------------------------------------------------
 * Kayıtlar
 * ------------------------------------------------------------------------- */

function flxai_page_log() {
	global $wpdb;
	flxai_page_head( __( 'Kayıtlar', 'flx-ai' ), __( 'Her model isteği ve araç çağrısı: hangi sistemden, kim için, hangi model, token, süre, maliyet. İçerik kişisel veriler maskelenerek saklanır.', 'flx-ai' ) );
	$kind   = sanitize_key( $_GET['kind'] ?? '' ); // phpcs:ignore
	$source = sanitize_key( $_GET['source'] ?? '' ); // phpcs:ignore
	$errs   = ! empty( $_GET['errors'] ); // phpcs:ignore
	$days   = (int) ( $_GET['days'] ?? 7 ); // phpcs:ignore
	$days   = in_array( $days, array( 1, 7, 30, 90, 365 ), true ) ? $days : 7;
	$pg     = max( 1, (int) ( $_GET['pg'] ?? 1 ) ); // phpcs:ignore
	$lib    = function_exists( 'flxa_list_form_attrs' ) && function_exists( 'flxa_list_per_page' ) && function_exists( 'flxa_list_pagination' );
	$per    = $lib ? flxa_list_per_page( 'flxai-log', 50 ) : 100;
	$t      = flxai_table( 'log' );
	$b      = flxai_table( 'log_body' );
	$where  = $wpdb->prepare( 'l.ts >= %d', time() - $days * DAY_IN_SECONDS );
	if ( in_array( $kind, array( 'model', 'tool' ), true ) ) {
		$where .= $wpdb->prepare( ' AND l.kind = %s', $kind );
	}
	if ( '' !== $source ) {
		$where .= $wpdb->prepare( ' AND l.source = %s', $source );
	}
	if ( $errs ) {
		$where .= ' AND l.ok = 0';
	}
	$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$t} l WHERE {$where}" ); // phpcs:ignore
	$rows  = $wpdb->get_results( "SELECT l.*, (b.log_id IS NOT NULL) AS has_body FROM {$t} l LEFT JOIN {$b} b ON b.log_id = l.id WHERE {$where} ORDER BY l.id DESC LIMIT " . (int) $per . ' OFFSET ' . (int) ( ( $pg - 1 ) * $per ), ARRAY_A ); // phpcs:ignore

	$sources = flxai_sources();
	foreach ( flxai_systems() as $sys ) {
		$sources[ $sys['source'] ] = $sys['label'];
	}
	$kind_sel = '<select name="kind"%s><option value="">' . esc_html__( 'Tümü', 'flx-ai' ) . '</option><option value="model"' . selected( $kind, 'model', false ) . '>' . esc_html__( 'Model istekleri', 'flx-ai' ) . '</option><option value="tool"' . selected( $kind, 'tool', false ) . '>' . esc_html__( 'Araç çağrıları', 'flx-ai' ) . '</option></select>';
	$src_sel  = '<select name="source"%s><option value="">' . esc_html__( 'Tüm sistemler', 'flx-ai' ) . '</option>';
	foreach ( $sources as $id => $label ) {
		$src_sel .= sprintf( '<option value="%s"%s>%s</option>', esc_attr( $id ), selected( $source, $id, false ), esc_html( $label ) );
	}
	$src_sel .= '</select>';
	$err_chk  = '<label class="flxai-check"%s><input type="checkbox" name="errors" value="1"' . checked( $errs, true, false ) . '%s> ' . esc_html__( 'Yalnız hatalar', 'flx-ai' ) . '</label>';
	if ( $lib ) {
		// Flux Admin ortak liste çubuğu: dönem + tür görünür, diğerleri "Filtreler" panelinde.
		echo '<form class="flxai-filters flxai-filters-lib" method="get"' . flxa_list_form_attrs( array( 'key' => 'flxai-log' ) ) . '><input type="hidden" name="page" value="flx-ai-log">'; // phpcs:ignore
		echo '<select name="days" data-flxa-primary>';
		foreach ( array( 1, 7, 30, 90, 365 ) as $d ) {
			/* translators: %d: days */
			printf( '<option value="%1$d"%2$s>%3$s</option>', (int) $d, selected( $days, $d, false ), esc_html( 1 === $d ? __( '24 saat', 'flx-ai' ) : sprintf( __( '%d gün', 'flx-ai' ), $d ) ) );
		}
		echo '</select>';
		printf( $kind_sel, ' data-flxa-primary' ); // phpcs:ignore -- escaped above
		printf( $src_sel, '' ); // phpcs:ignore
		printf( $err_chk, '', '' ); // phpcs:ignore
		echo '<button class="button">' . esc_html__( 'Filtrele', 'flx-ai' ) . '</button></form>';
	} else {
		echo '<form class="flxai-filters" method="get"><input type="hidden" name="page" value="flx-ai-log"><div class="flxai-seg">';
		foreach ( array( 1, 7, 30, 90 ) as $d ) {
			/* translators: %d: days */
			printf( '<button type="submit" name="days" value="%1$d" class="%2$s">%3$s</button>', (int) $d, $d === $days ? 'is-on' : '', esc_html( 1 === $d ? __( '24 saat', 'flx-ai' ) : sprintf( __( '%d gün', 'flx-ai' ), $d ) ) );
		}
		echo '</div><input type="hidden" name="days" value="' . esc_attr( $days ) . '">';
		printf( $kind_sel, ' onchange="this.form.submit()"' ); // phpcs:ignore
		printf( $src_sel, ' onchange="this.form.submit()"' ); // phpcs:ignore
		printf( $err_chk, '', ' onchange="this.form.submit()"' ); // phpcs:ignore
		echo '</form>';
	}
	if ( ! $lib ) {
		/* translators: %s: count */
		echo '<p class="flxai-note flxai-count">' . esc_html( sprintf( __( '%s kayıt', 'flx-ai' ), number_format_i18n( $total ) ) ) . '</p>';
	}
	if ( ! $rows ) {
		echo '<p class="flxai-empty">' . esc_html__( 'Kayıt yok.', 'flx-ai' ) . '</p></div>';
		return;
	}
	$users = array();
	echo '<div class="flxai-card"><div class="flxai-tscroll"><table class="flxai-table flxai-log"><thead><tr><th>' . esc_html__( 'Zaman', 'flx-ai' ) . '</th><th>' . esc_html__( 'Nerede', 'flx-ai' ) . '</th><th>' . esc_html__( 'Kim', 'flx-ai' ) . '</th><th>' . esc_html__( 'Model / araç', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Giriş', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Çıkış', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Önbellek', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Süre', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Maliyet', 'flx-ai' ) . '</th><th></th></tr></thead><tbody>';
	foreach ( $rows as $r ) {
		$what = 'tool' === $r['kind'] ? '<span class="flxai-pill">' . esc_html__( 'araç', 'flx-ai' ) . '</span> ' . esc_html( $r['tool'] ) : esc_html( flxai_model_label( $r['model'] ) );
		if ( ! (int) $r['ok'] ) {
			$err   = 'limit' === $r['error'] ? __( 'Harcama sınırı doldu', 'flx-ai' ) : ( 'off' === $r['error'] ? __( 'Kapalı (Bağlı sistemler)', 'flx-ai' ) : $r['error'] );
			$what .= '<div class="flxai-err">' . esc_html( $err ) . '</div>';
		}
		$uid = (int) $r['user_id'];
		if ( $uid && ! isset( $users[ $uid ] ) ) {
			$u             = get_userdata( $uid );
			$users[ $uid ] = $u ? $u->display_name : '#' . $uid;
		}
		$where_txt = ( $sources[ $r['source'] ] ?? flxai_source_label( $r['source'] ) ) . ( '' !== $r['purpose'] ? ' · ' . flxai_purpose_label( $r['purpose'] ) : '' ) . ( (int) $r['chat_id'] ? ' #' . (int) $r['chat_id'] : '' );
		printf(
			'<tr class="%10$s"><td>%1$s</td><td>%2$s</td><td>%3$s</td><td>%4$s</td><td class="num">%5$s</td><td class="num">%6$s</td><td class="num">%7$s</td><td class="num">%8$s</td><td class="num">%9$s</td><td>%11$s</td></tr>',
			esc_html( flx_date( (int) $r['ts'], 'j M H:i:s' ) ),
			esc_html( $where_txt ),
			esc_html( $uid ? $users[ $uid ] : __( 'Sistem', 'flx-ai' ) ),
			$what, // phpcs:ignore -- escaped above
			esc_html( number_format_i18n( (int) $r['in_tok'] ) ),
			esc_html( number_format_i18n( (int) $r['out_tok'] ) ),
			esc_html( (int) $r['cache_read'] || (int) $r['cache_write'] ? number_format_i18n( (int) $r['cache_read'] ) . ' / ' . number_format_i18n( (int) $r['cache_write'] ) : '—' ),
			esc_html( flxai_ms( (int) $r['ms'] ) ),
			esc_html( 'tool' === $r['kind'] ? '—' : flxai_usd( (float) $r['cost'], 5 ) . ( (int) $r['est'] ? ' ~' : '' ) ),
			(int) $r['ok'] ? '' : 'is-err',
			(int) $r['has_body'] ? '<button type="button" class="button button-small" data-flxai-body="' . (int) $r['id'] . '">' . esc_html__( 'İçerik', 'flx-ai' ) . '</button>' : ''
		);
	}
	echo '</tbody></table></div>';
	if ( $lib ) {
		flxa_list_pagination( $total, $per, $pg, array( 'page_arg' => 'pg' ) );
	} else {
		$pages = (int) ceil( $total / $per );
		if ( $pages > 1 ) {
			echo '<p class="flxai-pager">';
			$base = remove_query_arg( 'pg' );
			if ( $pg > 1 ) {
				echo '<a class="button" href="' . esc_url( add_query_arg( 'pg', $pg - 1, $base ) ) . '">‹</a> ';
			}
			/* translators: 1: page, 2: pages */
			echo '<span>' . esc_html( sprintf( __( 'Sayfa %1$s / %2$s', 'flx-ai' ), number_format_i18n( $pg ), number_format_i18n( $pages ) ) ) . '</span>';
			if ( $pg < $pages ) {
				echo ' <a class="button" href="' . esc_url( add_query_arg( 'pg', $pg + 1, $base ) ) . '">›</a>';
			}
			echo '</p>';
		}
	}
	echo '<p class="flxai-note">' . esc_html__( 'Önbellek sütunu: okunan / yazılan token. "~" fiyat listesinden tahmin. İçerik: giden son mesajlar ve gelen cevap, kısaltılmış; e-posta, telefon, IBAN ve anahtarlar maskeli.', 'flx-ai' ) . '</p></div></div>';
}

/* ---------------------------------------------------------------------------
 * Bağlı sistemler
 * ------------------------------------------------------------------------- */

function flxai_page_systems() {
	if ( ! empty( $_GET['system'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		flxai_page_system_settings( sanitize_key( wp_unslash( $_GET['system'] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return;
	}
	$saved = false;
	if ( isset( $_POST['flxai_systems_nonce'] ) && wp_verify_nonce( sanitize_key( $_POST['flxai_systems_nonce'] ), 'flxai_systems' ) && flxai_can_manage() ) {
		$all = array_map( 'sanitize_key', (array) wp_unslash( $_POST['sys'] ?? array() ) ); // phpcs:ignore
		$on  = array_map( 'sanitize_key', (array) wp_unslash( $_POST['sys_on'] ?? array() ) ); // phpcs:ignore
		$changes = array();
		foreach ( $all as $source ) { $changes[ $source ] = in_array( $source, $on, true ); }
		$result = flxai_admin_systems_toggle( array( 'revision' => (string) ( $_POST['revision'] ?? '' ), 'changes' => $changes ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		if ( is_wp_error( $result ) ) { wp_die( esc_html( $result->get_error_message() ), '', array( 'response' => (int) ( $result->get_error_data()['status'] ?? 400 ) ) ); }
		$saved = true;
	}
	flxai_page_head( __( 'Bağlı sistemler', 'flx-ai' ), __( 'Flux AI\'yı kullanan eklentiler. Buradan kapatılan sistem yapay zekâ isteği gönderemez; kendi ayarları da olduğu gibi kalır.', 'flx-ai' ) );
	if ( $saved ) {
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Kaydedildi.', 'flx-ai' ) . '</p></div>';
	}
	$rows = flxai_systems();
	echo '<form method="post">';
	wp_nonce_field( 'flxai_systems', 'flxai_systems_nonce' );
	echo '<input type="hidden" name="revision" value="' . esc_attr( flxai_admin_systems_revision( $rows ) ) . '">';
	echo '<div class="flxai-card"><div class="flxai-tscroll"><table class="flxai-table flxai-systems"><thead><tr><th>' . esc_html__( 'Açık', 'flx-ai' ) . '</th><th>' . esc_html__( 'Sistem', 'flx-ai' ) . '</th><th>' . esc_html__( 'Durum', 'flx-ai' ) . '</th><th>' . esc_html__( 'Model', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'İstek (30 gün)', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Token', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Maliyet', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Hata', 'flx-ai' ) . '</th><th>' . esc_html__( 'Son kullanım', 'flx-ai' ) . '</th><th></th></tr></thead><tbody>';
	foreach ( $rows as $r ) {
		if ( ! $r['installed'] ) {
			$state = '<span class="flxai-pill">' . esc_html__( 'kurulu değil', 'flx-ai' ) . '</span>';
		} elseif ( ! $r['active'] ) {
			$state = '<span class="flxai-pill">' . esc_html__( 'eklenti pasif', 'flx-ai' ) . '</span>';
		} elseif ( ! $r['on'] ) {
			$state = '<span class="flxai-pill is-err">' . esc_html__( 'AI kapalı', 'flx-ai' ) . '</span>';
		} else {
			$state = '<span class="flxai-pill is-ok">' . esc_html__( 'çalışıyor', 'flx-ai' ) . '</span>';
		}
		$links = '<a href="' . esc_url( admin_url( 'admin.php?page=flx-ai-log&days=30&source=' . rawurlencode( $r['source'] ) ) ) . '">' . esc_html__( 'Kayıtlar', 'flx-ai' ) . '</a>';
		if ( flxai_system_has_settings( $r['source'] ) ) {
			$links .= ' · <a href="' . esc_url( admin_url( 'admin.php?page=flx-ai-systems&system=' . rawurlencode( $r['source'] ) ) ) . '">' . esc_html__( 'AI ayarları', 'flx-ai' ) . '</a>';
		}
		if ( '' !== $r['page'] && $r['active'] ) {
			$links .= ' · <a href="' . esc_url( admin_url( $r['page'] ) ) . '">' . esc_html__( 'Ayarları', 'flx-ai' ) . '</a>';
		}
		printf(
			'<tr><td><input type="hidden" name="sys[]" value="%1$s"><label class="flxai-switch"><input type="checkbox" name="sys_on[]" value="%1$s"%2$s><span class="screen-reader-text">%3$s</span></label></td><td><strong>%3$s</strong><div class="flxai-kpi-s"><code>%1$s</code></div></td><td>%4$s</td><td>%5$s</td><td class="num">%6$s</td><td class="num">%7$s</td><td class="num">%8$s</td><td class="num">%9$s</td><td>%10$s</td><td>%11$s</td></tr>',
			esc_attr( $r['source'] ),
			checked( $r['on'], true, false ),
			esc_html( $r['label'] ),
			$state, // phpcs:ignore -- escaped above
			esc_html( '' !== $r['model'] ? flxai_model_label( $r['model'] ) : '—' ),
			esc_html( number_format_i18n( $r['calls'] ) . ( $r['tools'] ? ' + ' . number_format_i18n( $r['tools'] ) : '' ) ),
			esc_html( number_format_i18n( $r['tok'] ) ),
			esc_html( flxai_usd( $r['cost'] ) ),
			esc_html( number_format_i18n( $r['errors'] ) ),
			esc_html( $r['last'] ? flx_date( $r['last'], 'j M H:i' ) : '—' ),
			$links // phpcs:ignore -- escaped above
		);
	}
	echo '</tbody></table></div>';
	echo '<p class="flxai-note">' . esc_html__( 'Model sütunu: o sistemin kullandığı model. Değiştirmek için Ayarlar › Eklentiye özel model. Kapalı sistemin istekleri reddedilir ve Kayıtlar\'da "Kapalı" olarak görünür.', 'flx-ai' ) . ' <a href="' . esc_url( admin_url( 'admin.php?page=flx-ai-settings' ) ) . '">' . esc_html__( 'Ayarlar', 'flx-ai' ) . '</a></p></div>';
	echo '<p class="submit"><button type="submit" class="button button-primary">' . esc_html__( 'Kaydet', 'flx-ai' ) . '</button></p></form></div>';
}

/* ---------------------------------------------------------------------------
 * Faturalandırma
 * ------------------------------------------------------------------------- */

function flxai_page_billing() {
	$ym   = sanitize_text_field( wp_unslash( $_GET['ym'] ?? wp_date( 'Y-m' ) ) ); // phpcs:ignore
	$bill = flxai_billing( $ym );
	$ym   = $bill['ym'];
	$t    = $bill['totals'];
	flxai_page_head( __( 'Faturalandırma', 'flx-ai' ), __( 'Aylık döküm, harcama sınırları ve sağlayıcı kredisi. Tutarlar USD; OpenRouter gerçek maliyeti, Anthropic fiyat listesinden hesaplanır.', 'flx-ai' ) );
	flxai_budget_cards();

	echo '<div class="flxai-grid flxai-bill">';
	echo '<section class="flxai-card"><h2>' . esc_html__( 'Aylar', 'flx-ai' ) . '</h2><ul class="flxai-months">';
	foreach ( flxai_months( 12 ) as $m ) {
		printf(
			'<li><a href="%1$s" class="%2$s"><span>%3$s</span><strong>%4$s</strong></a></li>',
			esc_url( admin_url( 'admin.php?page=flx-ai-billing&ym=' . $m['ym'] ) ),
			$m['ym'] === $ym ? 'is-on' : '',
			esc_html( $m['label'] ),
			esc_html( flxai_usd( $m['cost'], $m['cost'] > 0 && $m['cost'] < 1 ? 4 : 2 ) )
		);
	}
	echo '</ul></section>';

	echo '<section class="flxai-card flxai-span2"><div class="flxai-bill-head"><h2>' . esc_html( flx_date( $bill['from'], 'F Y' ) ) . '</h2>';
	echo '<a class="button" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=flxai_csv&ym=' . $ym ), 'flxai_csv' ) ) . '">' . esc_html__( 'CSV indir', 'flx-ai' ) . '</a></div>';
	echo '<div class="flxai-kpis">';
	flxai_kpi( __( 'Toplam', 'flx-ai' ), flxai_usd( $t['cost'], 4 ), sprintf( /* translators: %s: amount */ __( 'Önbelleksiz olsaydı %s', 'flx-ai' ), flxai_usd( $t['full_cost'], 4 ) ) );
	flxai_kpi( __( 'Önbellek tasarrufu', 'flx-ai' ), flxai_usd( $t['saved'], 4 ), $t['full_cost'] > 0 ? sprintf( /* translators: %s: percent */ __( '%%%s daha az', 'flx-ai' ), number_format_i18n( $t['saved'] / $t['full_cost'] * 100, 1 ) ) : '' );
	flxai_kpi( __( 'Model istekleri', 'flx-ai' ), number_format_i18n( $t['calls'] ), '' );
	echo '</div><div class="flxai-chart" data-chart="cost"></div>';
	echo '<script type="application/json" id="flxai-chart-data">' . wp_json_encode( array( 'daily' => $bill['daily'], 'tools' => array() ) ) . '</script>';

	echo '<h3>' . esc_html__( 'Sağlayıcıya göre', 'flx-ai' ) . '</h3><div class="flxai-tscroll"><table class="flxai-table"><thead><tr><th>' . esc_html__( 'Sağlayıcı', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'İstek', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Giriş', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Çıkış', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Önbelleksiz', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Tutar', 'flx-ai' ) . '</th></tr></thead><tbody>';
	foreach ( $bill['by_provider'] as $r ) {
		printf(
			'<tr><td>%1$s%7$s</td><td class="num">%2$s</td><td class="num">%3$s</td><td class="num">%4$s</td><td class="num">%5$s</td><td class="num"><strong>%6$s</strong></td></tr>',
			esc_html( $r['label'] ),
			esc_html( number_format_i18n( (int) $r['calls'] ) ),
			esc_html( number_format_i18n( (int) $r['in_tok'] ) ),
			esc_html( number_format_i18n( (int) $r['out_tok'] ) ),
			esc_html( flxai_usd( (float) $r['full_cost'], 4 ) ),
			esc_html( flxai_usd( (float) $r['cost'], 4 ) ),
			(int) $r['est'] ? ' <span class="flxai-pill">' . esc_html__( 'kısmen tahmini', 'flx-ai' ) . '</span>' : ''
		);
	}
	if ( ! $bill['by_provider'] ) {
		echo '<tr><td colspan="6" class="flxai-empty">' . esc_html__( 'Bu ay kayıt yok.', 'flx-ai' ) . '</td></tr>';
	}
	echo '</tbody></table></div></section></div>';

	echo '<div class="flxai-grid">';
	flxai_breakdown_table( __( 'Eklentiye göre', 'flx-ai' ), $bill['by_source'] );
	flxai_breakdown_table( __( 'Modele göre', 'flx-ai' ), $bill['by_model'] );
	echo '</div>';

	$cr = get_option( 'flxai_or_credits', null );
	echo '<section class="flxai-card"><div class="flxai-bill-head"><h2>' . esc_html__( 'OpenRouter hesabı', 'flx-ai' ) . '</h2><button type="button" class="button" data-flxai-credits>' . esc_html__( 'Yenile', 'flx-ai' ) . '</button></div><div id="flxai-credits">';
	if ( is_array( $cr ) ) {
		echo '<dl class="flxai-dl">';
		if ( null !== $cr['credits'] ) {
			echo '<dt>' . esc_html__( 'Kalan kredi', 'flx-ai' ) . '</dt><dd>' . esc_html( flxai_usd( $cr['credits'], 2 ) ) . '</dd>';
		}
		if ( null !== $cr['usage'] ) {
			echo '<dt>' . esc_html__( 'Bu anahtarın toplam kullanımı', 'flx-ai' ) . '</dt><dd>' . esc_html( flxai_usd( $cr['usage'], 2 ) ) . '</dd>';
		}
		if ( null !== $cr['limit'] ) {
			echo '<dt>' . esc_html__( 'Anahtar sınırı / kalan', 'flx-ai' ) . '</dt><dd>' . esc_html( flxai_usd( $cr['limit'], 2 ) . ' / ' . flxai_usd( (float) $cr['remaining'], 2 ) ) . '</dd>';
		}
		echo '<dt>' . esc_html__( 'Kontrol', 'flx-ai' ) . '</dt><dd>' . esc_html( flx_date( (int) $cr['checked'], 'j M H:i' ) ) . '</dd></dl>';
	} else {
		echo '<p class="flxai-empty">' . esc_html__( 'Kalan krediyi görmek için Yenile\'ye basın. (Anthropic bakiye API\'si sunmuyor; console.anthropic.com › Billing.)', 'flx-ai' ) . '</p>';
	}
	echo '</div></section></div>';
}

/* ---------------------------------------------------------------------------
 * Ayarlar
 * ------------------------------------------------------------------------- */

function flxai_save_settings() {
	if ( ! isset( $_POST['flxai_settings_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['flxai_settings_nonce'] ), 'flxai_settings' ) || ! flxai_can_manage() ) {
		return false;
	}
	$p   = wp_unslash( $_POST ); // phpcs:ignore
	$new = array();
	foreach ( array( 'key_openrouter', 'key_anthropic', 'key_render', 'key_fal', 'key_evolink', 'key_openai', 'key_gemini' ) as $k ) {
		$v = trim( (string) ( $p[ $k ] ?? '' ) );
		if ( ! empty( $p[ $k . '_clear' ] ) ) {
			$new[ $k ] = '';
		} elseif ( '' !== $v ) {
			$new[ $k ] = sanitize_text_field( $v );
		}
	}
	$new['anthropic_workspace'] = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $p['anthropic_workspace'] ?? '' ) );
	foreach ( array( 'model', 'chat_model', 'title_model' ) as $k ) {
		$new[ $k ] = sanitize_text_field( (string) ( $p[ $k ] ?? '' ) );
	}
	$map = array();
	foreach ( (array) ( $p['source_models'] ?? array() ) as $src => $m ) {
		$m = sanitize_text_field( (string) $m );
		if ( '' !== $m ) {
			$map[ sanitize_key( $src ) ] = $m;
		}
	}
	$new['source_models']  = $map;
	$new['cache']          = in_array( $p['cache'] ?? '', array( 'off', '5m', '1h' ), true ) ? $p['cache'] : '5m';
	$new['effort']         = in_array( $p['effort'] ?? '', array( 'low', 'medium', 'high' ), true ) ? $p['effort'] : 'low';
	$new['thinking']       = empty( $p['thinking'] ) ? 0 : 1;
	foreach ( array( 'limit_day', 'limit_week', 'limit_month' ) as $k ) {
		$new[ $k ] = max( 0, round( (float) str_replace( ',', '.', (string) ( $p[ $k ] ?? 0 ) ), 2 ) );
	}
	$new['limit_action']   = 'warn' === ( $p['limit_action'] ?? '' ) ? 'warn' : 'block';
	$new['limit_warn_pct'] = max( 10, min( 99, (int) ( $p['limit_warn_pct'] ?? 80 ) ) );
	$new['limit_notify']   = empty( $p['limit_notify'] ) ? 0 : 1;
	$roles                 = array_map( 'sanitize_key', (array) ( $p['chat_roles'] ?? array() ) );
	$new['chat_roles']     = array_values( array_intersect( $roles, array_keys( wp_roles()->get_names() ) ) );
	$new['chat_admin']     = empty( $p['chat_admin'] ) ? 0 : 1;
	$new['chat_front']     = empty( $p['chat_front'] ) ? 0 : 1;
	$new['chat_mode']      = 'dock' === ( $p['chat_mode'] ?? '' ) ? 'dock' : 'bubble';
	$new['chat_max_rounds'] = max( 2, min( 30, (int) ( $p['chat_max_rounds'] ?? 12 ) ) );
	$new['chat_history']   = max( 6, min( 200, (int) ( $p['chat_history'] ?? 40 ) ) );
	$new['chat_instructions'] = sanitize_textarea_field( (string) ( $p['chat_instructions'] ?? '' ) );
	$new['chat_widgets']   = empty( $p['chat_widgets'] ) ? 0 : 1;
	$new['render_url']     = esc_url_raw( trim( (string) ( $p['render_url'] ?? '' ) ), array( 'http', 'https' ) );
	$new['render_user']    = sanitize_text_field( (string) ( $p['render_user'] ?? '' ) );
	$flxai_cat = flxai_media_catalog();
	foreach ( array( 'media_image_model' => 'image', 'media_video_model' => 'video' ) as $k => $kind ) {
		$m = sanitize_text_field( (string) ( $p[ $k ] ?? '' ) );
		if ( isset( $flxai_cat[ $m ] ) && $kind === $flxai_cat[ $m ]['kind'] ) {
			$new[ $k ] = $m;
		}
	}
	$new['media_days']     = max( 7, min( 1825, (int) ( $p['media_days'] ?? 90 ) ) );
	// Boş ya da 0 = sınırsız.
	$new['log_days']       = max( 0, min( 3650, (int) ( $p['log_days'] ?? 0 ) ) );
	$new['log_bodies']     = empty( $p['log_bodies'] ) ? 0 : 1;
	$new['log_body_days']  = max( 0, min( 3650, (int) ( $p['log_body_days'] ?? 0 ) ) );
	$new['delete_data']    = empty( $p['delete_data'] ) ? 0 : 1;
	$old_keys              = array( flxai_setting( 'key_openrouter' ), flxai_setting( 'key_anthropic' ), flxai_setting( 'anthropic_workspace' ) );
	flxai_update_settings( $new );
	if ( array( flxai_setting( 'key_openrouter' ), flxai_setting( 'key_anthropic' ), flxai_setting( 'anthropic_workspace' ) ) !== $old_keys ) {
		flxai_models_flush();
	}
	return true;
}

/** Model seçici alanı (ortak model-picker.js ile zenginleşir). */
function flxai_model_field( $name, $value, $placeholder = '' ) {
	printf(
		'<input type="text" class="regular-text flxai-model" data-flxai-model name="%1$s" value="%2$s" placeholder="%3$s" autocomplete="off">',
		esc_attr( $name ),
		esc_attr( $value ),
		esc_attr( $placeholder )
	);
}

function flxai_page_settings() {
	$saved = flxai_save_settings();
	flxai_page_head( __( 'Flux AI ayarları', 'flx-ai' ), __( 'Anahtarlar burada bir kez girilir; tüm FluxWP eklentileri bu bağlantıyı kullanır.', 'flx-ai' ) );
	if ( $saved ) {
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__( 'Ayarlar kaydedildi.', 'flx-ai' ) . '</p></div>';
	}
	$s   = flxai_settings();
	$or  = flxai_setting( 'key_openrouter' );
	$an  = flxai_setting( 'key_anthropic' );
	$def = flxai_model_for( '' );
	?>
	<form method="post" class="flxai-settings" autocomplete="off">
		<?php wp_nonce_field( 'flxai_settings', 'flxai_settings_nonce' ); ?>
		<section class="flxai-card">
			<h2><?php esc_html_e( 'Sağlayıcılar', 'flx-ai' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr><th><label for="flxai-or"><?php esc_html_e( 'OpenRouter API anahtarı', 'flx-ai' ); ?></label></th><td>
					<input id="flxai-or" type="password" class="regular-text" name="key_openrouter" value="" placeholder="<?php echo esc_attr( $or ? flxai_mask( $or ) : 'sk-or-…' ); ?>" autocomplete="new-password">
					<?php if ( $or ) : ?><label class="flxai-check"><input type="checkbox" name="key_openrouter_clear" value="1"> <?php esc_html_e( 'Sil', 'flx-ai' ); ?></label><?php endif; ?>
					<p class="description"><?php esc_html_e( 'openrouter.ai › Keys. Yüzlerce model tek anahtarla; gerçek maliyet her istekte bildirilir.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><label for="flxai-an"><?php esc_html_e( 'Anthropic (Claude) API anahtarı', 'flx-ai' ); ?></label></th><td>
					<input id="flxai-an" type="password" class="regular-text" name="key_anthropic" value="" placeholder="<?php echo esc_attr( $an ? flxai_mask( $an ) : 'sk-ant-…' ); ?>" autocomplete="new-password">
					<?php if ( $an ) : ?><label class="flxai-check"><input type="checkbox" name="key_anthropic_clear" value="1"> <?php esc_html_e( 'Sil', 'flx-ai' ); ?></label><?php endif; ?>
					<p class="description"><?php esc_html_e( 'console.anthropic.com › API Keys. Claude modelleri "claude:" önekiyle listelenir.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><label for="flxai-ws"><?php esc_html_e( 'Anthropic workspace ID', 'flx-ai' ); ?></label></th><td>
					<input id="flxai-ws" type="text" class="regular-text" name="anthropic_workspace" value="<?php echo esc_attr( $s['anthropic_workspace'] ); ?>" placeholder="wrkspc_…">
					<p class="description"><?php esc_html_e( 'Yalnız anahtar bir workspace\'e bağlı değilse gerekir (hata mesajı "anthropic-workspace-id" isterse).', 'flx-ai' ); ?></p></td></tr>
			</table>
		</section>

		<section class="flxai-card">
			<h2><?php esc_html_e( 'Modeller', 'flx-ai' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr><th><?php esc_html_e( 'Varsayılan model', 'flx-ai' ); ?></th><td><?php flxai_model_field( 'model', $s['model'], $def ); ?>
					<button type="button" class="button" data-flxai-test="model"><?php esc_html_e( 'Test et', 'flx-ai' ); ?></button><span class="flxai-test-out"></span>
					<p class="description"><?php esc_html_e( 'Eklentiler kendi modelini vermezse bu kullanılır.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'Ortak sohbet modeli', 'flx-ai' ); ?></th><td><?php flxai_model_field( 'chat_model', $s['chat_model'], __( 'Varsayılan', 'flx-ai' ) ); ?>
					<p class="description"><?php esc_html_e( 'Araç kullanabilen bir model seçin.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'Sohbet adı modeli', 'flx-ai' ); ?></th><td><?php flxai_model_field( 'title_model', $s['title_model'], __( 'Sohbet modeli', 'flx-ai' ) ); ?>
					<p class="description"><?php esc_html_e( 'Sohbete otomatik isim vermek için ucuz bir model yeterli.', 'flx-ai' ); ?></p></td></tr>
			</table>
			<h3><?php esc_html_e( 'Eklentiye özel model', 'flx-ai' ); ?></h3>
			<p class="description"><?php esc_html_e( 'Eklenti istekte model belirtmezse buradaki model kullanılır; boşsa varsayılan.', 'flx-ai' ); ?></p>
			<table class="form-table" role="presentation">
				<?php foreach ( flxai_sources() as $src => $label ) : ?>
					<?php
					if ( 'flx-ai' === $src ) {
						continue;
					}
					?>
					<tr><th><?php echo esc_html( $label ); ?></th><td><?php flxai_model_field( 'source_models[' . $src . ']', (string) ( $s['source_models'][ $src ] ?? '' ), __( 'Varsayılan', 'flx-ai' ) ); ?></td></tr>
				<?php endforeach; ?>
			</table>
		</section>

		<section class="flxai-card">
			<h2><?php esc_html_e( 'Önbellek ve düşünme', 'flx-ai' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr><th><?php esc_html_e( 'Claude prompt önbelleği', 'flx-ai' ); ?></th><td>
					<select name="cache">
						<option value="off" <?php selected( $s['cache'], 'off' ); ?>><?php esc_html_e( 'Kapalı', 'flx-ai' ); ?></option>
						<option value="5m" <?php selected( $s['cache'], '5m' ); ?>><?php esc_html_e( 'Açık, 5 dakika', 'flx-ai' ); ?></option>
						<option value="1h" <?php selected( $s['cache'], '1h' ); ?>><?php esc_html_e( 'Açık, 1 saat', 'flx-ai' ); ?></option>
					</select>
					<p class="description"><?php esc_html_e( 'Aynı talimat ve araçlar tekrar gönderilince giriş ücretinin çoğu düşer (okuma 0,1x; yazma 5 dk 1,25x, 1 saat 2x). Eklentiler istek başına değiştirebilir. OpenRouter önbelleği sağlayıcıda otomatik.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'Claude çaba (effort)', 'flx-ai' ); ?></th><td>
					<select name="effort">
						<option value="low" <?php selected( $s['effort'], 'low' ); ?>><?php esc_html_e( 'Düşük: hızlı ve ucuz', 'flx-ai' ); ?></option>
						<option value="medium" <?php selected( $s['effort'], 'medium' ); ?>><?php esc_html_e( 'Orta', 'flx-ai' ); ?></option>
						<option value="high" <?php selected( $s['effort'], 'high' ); ?>><?php esc_html_e( 'Yüksek: daha derin düşünür', 'flx-ai' ); ?></option>
					</select></td></tr>
				<tr><th><?php esc_html_e( 'Düşünme adımları', 'flx-ai' ); ?></th><td><label class="flxai-check"><input type="checkbox" name="thinking" value="1" <?php checked( $s['thinking'] ); ?>> <?php esc_html_e( 'Sohbette modelin düşünme özetini göster', 'flx-ai' ); ?></label></td></tr>
			</table>
		</section>

		<section class="flxai-card" id="limits">
			<h2><?php esc_html_e( 'Harcama sınırı', 'flx-ai' ); ?></h2>
			<table class="form-table" role="presentation">
				<?php foreach ( array( 'day' => __( 'Günlük (her gün 00:00\'da yenilenir)', 'flx-ai' ), 'week' => __( 'Haftalık (Pazartesi yenilenir)', 'flx-ai' ), 'month' => __( 'Aylık (ayın 1\'inde yenilenir)', 'flx-ai' ) ) as $p => $label ) : ?>
					<tr><th><?php echo esc_html( $label ); ?></th><td>$ <input type="number" step="0.01" min="0" class="small-text" name="limit_<?php echo esc_attr( $p ); ?>" value="<?php echo esc_attr( $s[ 'limit_' . $p ] ); ?>"> <span class="description"><?php esc_html_e( '0 = sınırsız', 'flx-ai' ); ?></span></td></tr>
				<?php endforeach; ?>
				<tr><th><?php esc_html_e( 'Sınır dolunca', 'flx-ai' ); ?></th><td>
					<label class="flxai-check"><input type="radio" name="limit_action" value="block" <?php checked( $s['limit_action'], 'block' ); ?>> <?php esc_html_e( 'İstekleri durdur (eklentiler kendi yedek davranışına geçer)', 'flx-ai' ); ?></label><br>
					<label class="flxai-check"><input type="radio" name="limit_action" value="warn" <?php checked( $s['limit_action'], 'warn' ); ?>> <?php esc_html_e( 'Yalnız uyar', 'flx-ai' ); ?></label></td></tr>
				<tr><th><?php esc_html_e( 'Uyarı eşiği', 'flx-ai' ); ?></th><td>% <input type="number" min="10" max="99" class="small-text" name="limit_warn_pct" value="<?php echo esc_attr( $s['limit_warn_pct'] ); ?>">
					<label class="flxai-check"><input type="checkbox" name="limit_notify" value="1" <?php checked( $s['limit_notify'] ); ?>> <?php esc_html_e( 'Eşikte ve dolunca yöneticiye e-posta', 'flx-ai' ); ?></label></td></tr>
			</table>
		</section>

		<section class="flxai-card">
			<h2><?php esc_html_e( 'Ortak sohbet', 'flx-ai' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr><th><?php esc_html_e( 'Kimler kullanır', 'flx-ai' ); ?></th><td>
					<?php foreach ( wp_roles()->get_names() as $role => $name ) : ?>
						<label class="flxai-check flxai-role"><input type="checkbox" name="chat_roles[]" value="<?php echo esc_attr( $role ); ?>" <?php checked( in_array( $role, (array) $s['chat_roles'], true ) ); ?>> <?php echo esc_html( translate_user_role( $name ) ); ?></label>
					<?php endforeach; ?>
					<p class="description"><?php esc_html_e( 'Herkes yalnız kendi yetkisinin izin verdiği araçları kullanır. Tek tek kullanıcıya "flxai_chat" yetkisi de verilebilir.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'Nerede görünsün', 'flx-ai' ); ?></th><td>
					<label class="flxai-check"><input type="checkbox" name="chat_admin" value="1" <?php checked( $s['chat_admin'] ); ?>> <?php esc_html_e( 'Yönetim paneli', 'flx-ai' ); ?></label>
					<label class="flxai-check"><input type="checkbox" name="chat_front" value="1" <?php checked( $s['chat_front'] ); ?>> <?php esc_html_e( 'Site (giriş yapmış yetkili kullanıcıya)', 'flx-ai' ); ?></label></td></tr>
				<tr><th><?php esc_html_e( 'Varsayılan görünüm', 'flx-ai' ); ?></th><td>
					<select name="chat_mode">
						<option value="bubble" <?php selected( $s['chat_mode'], 'bubble' ); ?>><?php esc_html_e( 'Yüzen pencere', 'flx-ai' ); ?></option>
						<option value="dock" <?php selected( $s['chat_mode'], 'dock' ); ?>><?php esc_html_e( 'Sağa yerleşik (sayfayı iter)', 'flx-ai' ); ?></option>
					</select>
					<p class="description"><?php esc_html_e( 'Kullanıcı panelden değiştirebilir; seçimi kendi tarayıcısında kalır.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'Tur başına en fazla adım', 'flx-ai' ); ?></th><td><input type="number" min="2" max="30" class="small-text" name="chat_max_rounds" value="<?php echo esc_attr( $s['chat_max_rounds'] ); ?>"></td></tr>
				<tr><th><?php esc_html_e( 'Modele giden en fazla mesaj', 'flx-ai' ); ?></th><td><input type="number" min="6" max="200" class="small-text" name="chat_history" value="<?php echo esc_attr( $s['chat_history'] ); ?>"></td></tr>
				<tr><th><?php esc_html_e( 'Ek talimatlar', 'flx-ai' ); ?></th><td><textarea name="chat_instructions" rows="5" class="large-text" placeholder="<?php esc_attr_e( 'Ör. Kurum dili resmi olsun; yeni sayfaları her zaman taslak aç.', 'flx-ai' ); ?>"><?php echo esc_textarea( $s['chat_instructions'] ); ?></textarea></td></tr>
			</table>
		</section>

		<section class="flxai-card" id="media">
			<h2><?php esc_html_e( 'Görsel ve video üretimi', 'flx-ai' ); ?></h2>
			<p class="description"><?php esc_html_e( 'Görsel ve video üreten eklentiler (Flux Studio vb.) bu anahtarları kullanır. Otomatik seçimde model için anahtarı girilmiş ilk sağlayıcı kullanılır; ücretli olabilecek bir istek başka sağlayıcıya tekrar gönderilmez. Harcama sınırı ve Kayıtlar burada da geçerlidir.', 'flx-ai' ); ?></p>
			<table class="form-table" role="presentation">
				<?php
				$flxai_mkeys = array(
					'key_fal'     => array( 'fal.ai', 'fal.ai › Dashboard › API Keys', '…:…' ),
					'key_evolink' => array( 'EvoLink', 'evolink.ai › API Keys', 'sk-…' ),
					'key_openai'  => array( 'OpenAI', 'platform.openai.com › API keys', 'sk-…' ),
					'key_gemini'  => array( 'Google Gemini', 'aistudio.google.com › API keys', 'AIza…' ),
				);
				foreach ( $flxai_mkeys as $flxai_k => $flxai_m ) :
					$flxai_v = flxai_setting( $flxai_k );
					?>
					<tr><th><label for="flxai-<?php echo esc_attr( $flxai_k ); ?>">
						<?php
						/* translators: %s: provider */
						echo esc_html( sprintf( __( '%s API anahtarı', 'flx-ai' ), $flxai_m[0] ) );
						?>
					</label></th><td>
						<input id="flxai-<?php echo esc_attr( $flxai_k ); ?>" type="password" class="regular-text" name="<?php echo esc_attr( $flxai_k ); ?>" value="" placeholder="<?php echo esc_attr( $flxai_v ? flxai_mask( $flxai_v ) : $flxai_m[2] ); ?>" autocomplete="new-password">
						<?php if ( $flxai_v ) : ?><label class="flxai-check"><input type="checkbox" name="<?php echo esc_attr( $flxai_k ); ?>_clear" value="1"> <?php esc_html_e( 'Sil', 'flx-ai' ); ?></label><?php endif; ?>
						<p class="description"><?php echo esc_html( $flxai_m[1] ); ?></p></td></tr>
				<?php endforeach; ?>
				<tr><th><?php esc_html_e( 'OpenRouter', 'flx-ai' ); ?></th><td><p class="description"><?php esc_html_e( 'Sağlayıcılar bölümündeki OpenRouter anahtarı görsel ve video için de kullanılır.', 'flx-ai' ); ?></p></td></tr>
				<?php
				$flxai_mp = flxai_media_providers();
				foreach ( array( 'media_image_model' => array( 'image', __( 'Varsayılan görsel modeli', 'flx-ai' ) ), 'media_video_model' => array( 'video', __( 'Varsayılan video modeli', 'flx-ai' ) ) ) as $flxai_k => $flxai_d ) :
					?>
					<tr><th><?php echo esc_html( $flxai_d[1] ); ?></th><td><select name="<?php echo esc_attr( $flxai_k ); ?>">
						<?php foreach ( $flxai_mp['models'] as $flxai_id => $flxai_mm ) : ?>
							<?php
							if ( $flxai_d[0] !== $flxai_mm['kind'] ) {
								continue;
							}
							?>
							<option value="<?php echo esc_attr( $flxai_id ); ?>" <?php selected( $s[ $flxai_k ] ?? '', $flxai_id ); ?>><?php echo esc_html( $flxai_mm['label'] ); ?></option>
						<?php endforeach; ?>
					</select></td></tr>
				<?php endforeach; ?>
				<tr><th><?php esc_html_e( 'Model › sağlayıcı', 'flx-ai' ); ?></th><td>
					<table class="widefat striped flxai-media-routes"><thead><tr><th><?php esc_html_e( 'Model', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Sıra', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Otomatik', 'flx-ai' ); ?></th></tr></thead><tbody>
					<?php foreach ( $flxai_mp['models'] as $flxai_mm ) : ?>
						<tr><td><?php echo esc_html( $flxai_mm['label'] . ( 'video' === $flxai_mm['kind'] ? ' · ' . __( 'video', 'flx-ai' ) : '' ) ); ?></td>
							<td><?php echo esc_html( implode( ' → ', array_map( fn( $x ) => $flxai_mp['providers'][ $x ]['label'] ?? $x, $flxai_mm['routes'] ) ) ); ?></td>
							<td><?php echo $flxai_mm['auto'] ? esc_html( $flxai_mp['providers'][ $flxai_mm['auto'] ]['label'] ) : '<span class="description">' . esc_html__( 'Anahtar yok', 'flx-ai' ) . '</span>'; ?></td></tr>
					<?php endforeach; ?>
					</tbody></table></td></tr>
				<tr><th><?php esc_html_e( 'İş kayıtları', 'flx-ai' ); ?></th><td><input type="number" min="7" max="1825" class="small-text" name="media_days" value="<?php echo esc_attr( $s['media_days'] ?? 90 ); ?>"> <?php esc_html_e( 'gün saklanır (üretilen dosyalar silinmez)', 'flx-ai' ); ?></td></tr>
			</table>
		</section>

		<section class="flxai-card" id="widgets">
			<h2><?php esc_html_e( 'Görseller', 'flx-ai' ); ?></h2>
			<?php
			$flxai_rnd = flxai_widget_renderer();
			$flxai_rk  = flxai_setting( 'key_render' );
			?>
			<table class="form-table" role="presentation">
				<tr><th><?php esc_html_e( 'Sohbette görsel', 'flx-ai' ); ?></th><td><label class="flxai-check"><input type="checkbox" name="chat_widgets" value="1" <?php checked( $s['chat_widgets'] ?? 1 ); ?>> <?php esc_html_e( 'Model tablo, kart, şema ve grafikleri görsel olarak çizebilsin (```widget ve ```mermaid)', 'flx-ai' ); ?></label>
					<p class="description"><?php esc_html_e( 'Her model ile çalışır. Görseller ayrı, izole bir çerçevede çizilir; dış bağlantı, form ve siteye erişim yoktur.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'Sunucuda görsel çevirici', 'flx-ai' ); ?></th><td>
					<p><?php echo esc_html( 'gotenberg' === $flxai_rnd ? __( 'Gotenberg: HTML ve SVG görseller PNG olarak gönderilebilir.', 'flx-ai' ) : ( 'imagick' === $flxai_rnd ? __( 'Imagick: yalnız SVG görseller PNG olarak gönderilebilir.', 'flx-ai' ) : __( 'Yok: WhatsApp gibi kanallarda görsel yerine metin gider.', 'flx-ai' ) ) ); ?></p>
					<input type="url" class="regular-text" name="render_url" value="<?php echo esc_attr( $s['render_url'] ?? '' ); ?>" placeholder="https://gotenberg.ornek.com">
					<p class="description"><?php esc_html_e( 'İsteğe bağlı. WhatsApp ve e-posta gibi kanallar HTML gösteremez; görseller PNG\'ye çevrilir. Paylaşımlı sunucuda tarayıcı olmadığı için HTML görseller Docker sunucusundaki Gotenberg ile çevrilir (gotenberg/gotenberg:8).', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'Gotenberg kullanıcı / şifre', 'flx-ai' ); ?></th><td>
					<input type="text" class="regular-text" name="render_user" value="<?php echo esc_attr( $s['render_user'] ?? '' ); ?>" autocomplete="off" style="max-width:180px">
					<input type="password" class="regular-text" name="key_render" value="" placeholder="<?php echo esc_attr( $flxai_rk ? flxai_mask( $flxai_rk ) : '' ); ?>" autocomplete="new-password" style="max-width:220px">
					<?php if ( $flxai_rk ) : ?><label class="flxai-check"><input type="checkbox" name="key_render_clear" value="1"> <?php esc_html_e( 'Sil', 'flx-ai' ); ?></label><?php endif; ?>
					<p class="description"><?php esc_html_e( 'Gotenberg temel kimlik doğrulama ile korunuyorsa.', 'flx-ai' ); ?></p>
					<p><button type="button" class="button" data-flxai-render-test><?php esc_html_e( 'Test et', 'flx-ai' ); ?></button><span class="flxai-test-out"></span></p>
					<div class="flxai-render-prev" hidden></div></td></tr>
			</table>
		</section>

		<section class="flxai-card">
			<h2><?php esc_html_e( 'Kayıtlar', 'flx-ai' ); ?></h2>
			<table class="form-table" role="presentation">
				<?php $flxai_ld = (int) ( $s['log_days'] ?? 0 ); $flxai_bd = (int) ( $s['log_body_days'] ?? 0 ); ?>
				<tr><th><?php esc_html_e( 'Kullanım kayıtlarını sakla', 'flx-ai' ); ?></th><td><input type="number" min="0" max="3650" class="small-text" name="log_days" value="<?php echo esc_attr( $flxai_ld > 0 ? $flxai_ld : '' ); ?>" placeholder="<?php esc_attr_e( 'Sınırsız', 'flx-ai' ); ?>" style="width:90px"> <?php esc_html_e( 'gün', 'flx-ai' ); ?>
					<p class="description"><?php esc_html_e( 'Boş bırakın: kayıtlar sınırsız saklanır. Gün girerseniz daha eski kayıtlar günde bir kez silinir.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'İçerik kaydı', 'flx-ai' ); ?></th><td><label class="flxai-check"><input type="checkbox" name="log_bodies" value="1" <?php checked( $s['log_bodies'] ?? 1 ); ?>> <?php esc_html_e( 'Giden/gelen içeriği de sakla (kısaltılmış; e-posta, telefon, IBAN ve anahtarlar maskeli)', 'flx-ai' ); ?></label>
					<p><input type="number" min="0" max="3650" class="small-text" name="log_body_days" value="<?php echo esc_attr( $flxai_bd > 0 ? $flxai_bd : '' ); ?>" placeholder="<?php esc_attr_e( 'Sınırsız', 'flx-ai' ); ?>" style="width:90px"> <?php esc_html_e( 'gün sakla', 'flx-ai' ); ?></p>
					<p class="description"><?php esc_html_e( 'Boş bırakın: içerik de sınırsız saklanır.', 'flx-ai' ); ?></p></td></tr>
				<tr><th><?php esc_html_e( 'Kaldırınca', 'flx-ai' ); ?></th><td><label class="flxai-check"><input type="checkbox" name="delete_data" value="1" <?php checked( $s['delete_data'] ); ?>> <?php esc_html_e( 'Eklenti silinirken kayıtları ve sohbetleri de sil', 'flx-ai' ); ?></label></td></tr>
			</table>
		</section>
		<p class="submit"><button type="submit" class="button button-primary button-hero"><?php esc_html_e( 'Kaydet', 'flx-ai' ); ?></button></p>
	</form>
	</div>
	<?php
}
