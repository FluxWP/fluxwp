<?php
/**
 * Flux AI & MCP › Araçlar: arama, süzgeçler, eklenti bazlı sayılar, toplu aç/kapat, ad çakışmaları.
 *
 * @package FLX_AI
 */

defined( 'ABSPATH' ) || exit;

/* Kaydet / toplu işlem / çakışma seçimi: ekran çizilmeden önce, sonra aynı süzgeçlerle geri dönülür. */
add_action(
	'admin_init',
	function () {
		if ( empty( $_POST['flxai_tools_nonce'] ) || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		check_admin_referer( 'flxai_tools', 'flxai_tools_nonce' );
		$post = wp_unslash( $_POST ); // phpcs:ignore WordPress.Security.ValidationSanitization
		$keep = array( 'saved' => 1 );
		$body = array( 'revision' => (string) ( $post['revision'] ?? '' ) );
		if ( ! empty( $post['pick'] ) && false !== strpos( (string) $post['pick'], '|' ) ) {
			list( $name, $src ) = explode( '|', (string) $post['pick'], 2 );
			$body['pick'] = array( 'name' => $name, 'source' => $src );
			$keep['picked'] = rawurlencode( $name );
		} else {
			$all = array_map( 'strval', (array) ( $post['all'] ?? array() ) );
			$on = array_map( 'strval', (array) ( $post['on'] ?? array() ) );
			$body['changes'] = array();
			foreach ( $all as $name ) { $body['changes'][ $name ] = in_array( $name, $on, true ); }
			$do = sanitize_key( $post['do'] ?? 'save' );
			if ( in_array( $do, array( 'on', 'off' ), true ) ) {
				$names = array_map( 'strval', (array) ( $post['sel'] ?? array() ) );
				$body['bulk'] = array( 'enabled' => 'on' === $do, 'names' => $names );
				$keep['bulk'] = count( $names );
			}
		}
		$result = flxai_admin_tools_update( $body );
		if ( is_wp_error( $result ) ) {
			wp_die( esc_html( $result->get_error_message() ), '', array( 'response' => (int) ( $result->get_error_data()['status'] ?? 400 ) ) );
		}
		wp_safe_redirect( add_query_arg( $keep, admin_url( 'admin.php?page=flx-ai-tools' ) ) );
		exit;
	}
);

function flxai_page_tools() {
	$rows  = flxai_tools_rows();
	$stats = flxai_admin_tool_usage();
	flxai_page_head( __( 'Araçlar', 'flx-ai' ), __( 'Eklentilerin yapay zekâya sunduğu araçlar: ortak sohbet ve MCP sunucusu. Kapatılan araç ikisinde de kullanılamaz; değişiklik yapan araçlar her seferinde onay ister.', 'flx-ai' ) );
	// phpcs:disable WordPress.Security.NonceVerification.Recommended
	if ( isset( $_GET['saved'] ) ) {
		$msg = isset( $_GET['bulk'] )
			/* translators: %s: number of tools */
			? sprintf( _n( '%s araç güncellendi.', '%s araç güncellendi.', (int) $_GET['bulk'], 'flx-ai' ), number_format_i18n( (int) $_GET['bulk'] ) )
			: ( isset( $_GET['picked'] )
				/* translators: %s: tool name */
				? sprintf( __( '%s için kullanılacak eklenti değişti.', 'flx-ai' ), sanitize_text_field( wp_unslash( $_GET['picked'] ) ) )
				: __( 'Kaydedildi.', 'flx-ai' ) );
		echo '<div class="notice notice-success is-dismissible"><p>' . esc_html( $msg ) . '</p></div>';
	}
	// phpcs:enable

	$active   = array_filter( $rows, fn( $r ) => ! $r['dupe'] );
	$n_on     = count( array_filter( $active, fn( $r ) => ! $r['off'] ) );
	$n_dupe   = count( array_unique( array_column( array_filter( $rows, fn( $r ) => $r['dupe'] ), 'name' ) ) );
	$n_noprfx = count( array_filter( $active, fn( $r ) => ! $r['prefixed'] ) );
	$by_src   = array();
	foreach ( $active as $r ) {
		$by_src[ $r['source'] ] = $by_src[ $r['source'] ] ?? array(
			'label' => $r['label'],
			'n'     => 0,
			'on'    => 0,
		);
		++$by_src[ $r['source'] ]['n'];
		$by_src[ $r['source'] ]['on'] += $r['off'] ? 0 : 1;
	}
	uasort( $by_src, fn( $a, $b ) => $b['n'] <=> $a['n'] ?: strcmp( $a['label'], $b['label'] ) );

	echo '<div class="flxai-kpis flxai-tools-kpis">';
	flxai_kpi( __( 'Araç', 'flx-ai' ), number_format_i18n( count( $active ) ), sprintf( /* translators: %s: number of plugins */ _n( '%s eklenti', '%s eklenti', count( $by_src ), 'flx-ai' ), number_format_i18n( count( $by_src ) ) ) );
	flxai_kpi( __( 'Açık', 'flx-ai' ), number_format_i18n( $n_on ), sprintf( /* translators: %s: number of tools */ __( '%s kapalı', 'flx-ai' ), number_format_i18n( count( $active ) - $n_on ) ) );
	flxai_kpi( __( 'Ad çakışması', 'flx-ai' ), number_format_i18n( $n_dupe ), $n_dupe ? __( 'Her adda yalnız biri açık', 'flx-ai' ) : __( 'Yok', 'flx-ai' ), null, $n_dupe > 0 );
	flxai_kpi( __( 'Öneksiz ad', 'flx-ai' ), number_format_i18n( $n_noprfx ), __( 'Eklenti öneki olmayan araç', 'flx-ai' ) );
	echo '</div>';

	echo '<form method="post" class="flxai-card flxai-toolsui" data-flxai-tools>';
	wp_nonce_field( 'flxai_tools', 'flxai_tools_nonce' );
	echo '<input type="hidden" name="revision" value="' . esc_attr( flxai_admin_tools_revision( $rows ) ) . '">';

	// Eklenti çipleri: tıklayınca o eklentiye süzer.
	echo '<div class="flxai-chips" role="group" aria-label="' . esc_attr__( 'Eklentiye göre', 'flx-ai' ) . '">';
	printf( '<button type="button" class="flxai-chip is-on" data-src=""><span>%1$s</span><b>%2$s</b></button>', esc_html__( 'Tümü', 'flx-ai' ), esc_html( number_format_i18n( count( $active ) ) ) );
	foreach ( $by_src as $id => $s ) {
		printf(
			'<button type="button" class="flxai-chip" data-src="%1$s" title="%1$s"><span>%2$s</span><b>%3$s</b></button>',
			esc_attr( $id ),
			esc_html( $s['label'] ),
			esc_html( $s['on'] === $s['n'] ? number_format_i18n( $s['n'] ) : number_format_i18n( $s['on'] ) . '/' . number_format_i18n( $s['n'] ) )
		);
	}
	echo '</div>';

	// Arama ve süzgeçler.
	echo '<div class="flxai-filters flxai-tools-filters">';
	echo '<label class="flxai-search"><span class="screen-reader-text">' . esc_html__( 'Araç ara', 'flx-ai' ) . '</span><input type="search" data-f="q" placeholder="' . esc_attr__( 'Ad, açıklama, eklenti ara…', 'flx-ai' ) . '"></label>';
	echo '<label><span class="screen-reader-text">' . esc_html__( 'Kaynak', 'flx-ai' ) . '</span><select data-f="src"><option value="">' . esc_html__( 'Tüm eklentiler', 'flx-ai' ) . '</option>';
	foreach ( $by_src as $id => $s ) {
		printf( '<option value="%1$s">%2$s (%3$s)</option>', esc_attr( $id ), esc_html( $s['label'] ), esc_html( number_format_i18n( $s['n'] ) ) );
	}
	echo '</select></label>';
	$seg = function ( $key, array $opts ) {
		echo '<div class="flxai-seg" role="group" data-f="' . esc_attr( $key ) . '">';
		$first = true;
		foreach ( $opts as $v => $l ) {
			printf( '<button type="button" data-v="%1$s" class="%2$s" aria-pressed="%3$s">%4$s</button>', esc_attr( $v ), $first ? 'is-on' : '', $first ? 'true' : 'false', esc_html( $l ) );
			$first = false;
		}
		echo '</div>';
	};
	$seg(
		'kind',
		array(
			''      => __( 'Tümü', 'flx-ai' ),
			'read'  => __( 'Okur', 'flx-ai' ),
			'write' => __( 'Değiştirir', 'flx-ai' ),
		)
	);
	$seg(
		'state',
		array(
			''         => __( 'Tümü', 'flx-ai' ),
			'on'       => __( 'Açık', 'flx-ai' ),
			'off'      => __( 'Kapalı', 'flx-ai' ),
			'conflict' => __( 'Çakışma', 'flx-ai' ),
			'noprefix' => __( 'Öneksiz', 'flx-ai' ),
		)
	);
	echo '<span class="flxai-note" data-count aria-live="polite"></span>';
	echo '</div>';

	// Toplu işlem çubuğu.
	echo '<div class="flxai-bulk" data-bulk hidden><span data-sel-count></span>';
	echo '<button type="submit" name="do" value="on" class="button">' . esc_html__( 'Aç', 'flx-ai' ) . '</button>';
	echo '<button type="submit" name="do" value="off" class="button">' . esc_html__( 'Kapat', 'flx-ai' ) . '</button>';
	echo '<button type="button" class="button-link" data-sel-clear>' . esc_html__( 'Seçimi kaldır', 'flx-ai' ) . '</button></div>';

	echo '<div class="flxai-tscroll"><table class="flxai-table flxai-tools"><thead><tr>';
	echo '<th class="flxai-col-sel"><input type="checkbox" data-sel-all aria-label="' . esc_attr__( 'Görünenlerin hepsini seç', 'flx-ai' ) . '"></th>';
	echo '<th>' . esc_html__( 'Açık', 'flx-ai' ) . '</th><th>' . esc_html__( 'Araç', 'flx-ai' ) . '</th><th>' . esc_html__( 'Kaynak', 'flx-ai' ) . '</th><th>' . esc_html__( 'Tür', 'flx-ai' ) . '</th><th>' . esc_html__( 'Nerede', 'flx-ai' ) . '</th><th>' . esc_html__( 'Yetki', 'flx-ai' ) . '</th><th class="num">' . esc_html__( '30 gün', 'flx-ai' ) . '</th><th class="num">' . esc_html__( 'Ort. süre', 'flx-ai' ) . '</th></tr></thead><tbody>';

	foreach ( $rows as $r ) {
		$s     = $stats[ $r['name'] ] ?? null;
		$state = $r['dupe'] ? 'dupe' : ( $r['off'] ? 'off' : 'on' );
		$q     = function_exists( 'mb_strtolower' ) ? mb_strtolower( $r['name'] . ' ' . $r['title'] . ' ' . $r['description'] . ' ' . $r['label'] . ' ' . $r['source'] . ' ' . implode( ' ', $r['aliases'] ) ) : strtolower( $r['name'] . ' ' . $r['title'] . ' ' . $r['label'] );

		$badges = '';
		if ( $r['dupe'] ) {
			$winner  = flxai_source_info( $r['rivals'][0] ?? '' )['label'];
			/* translators: %s: plugin name */
			$badges .= '<span class="flxai-pill is-err">' . esc_html( sprintf( __( 'Çakışma: kapalı, %s kullanılıyor', 'flx-ai' ), $winner ) ) . '</span> ';
		} elseif ( $r['rivals'] ) {
			$others  = implode( ', ', array_map( fn( $x ) => flxai_source_info( $x )['label'], $r['rivals'] ) );
			/* translators: %s: plugin names */
			$badges .= '<span class="flxai-pill is-warn">' . esc_html( sprintf( __( 'Çakışma: bu açık, %s kapalı', 'flx-ai' ), $others ) ) . '</span> ';
		}
		if ( ! $r['prefixed'] ) {
			$badges .= '<span class="flxai-pill" title="' . esc_attr__( 'Ad eklenti önekiyle başlamıyor; başka eklentinin aracıyla karışabilir.', 'flx-ai' ) . '">' . esc_html__( 'öneksiz', 'flx-ai' ) . '</span> ';
		}
		$alias = $r['aliases']
			/* translators: %s: old tool names */
			? '<div class="flxai-alias">' . esc_html( sprintf( __( 'Eski ad: %s', 'flx-ai' ), implode( ', ', $r['aliases'] ) ) ) . '</div>'
			: '';

		if ( $r['dupe'] ) {
			$toggle = '<button type="submit" class="button button-small" name="pick" value="' . esc_attr( $r['name'] . '|' . $r['source'] ) . '">' . esc_html__( 'Bunu kullan', 'flx-ai' ) . '</button>';
			$sel    = '';
		} else {
			$toggle = sprintf(
				'<input type="hidden" name="all[]" value="%1$s"><label class="flxai-switch"><input type="checkbox" name="on[]" value="%1$s"%2$s><span class="screen-reader-text">%3$s</span></label>',
				esc_attr( $r['name'] ),
				checked( ! $r['off'], true, false ),
				/* translators: %s: tool title */
				esc_html( sprintf( __( '%s açık', 'flx-ai' ), $r['title'] ) )
			);
			$sel    = sprintf( '<input type="checkbox" name="sel[]" value="%1$s" data-sel aria-label="%2$s">', esc_attr( $r['name'] ), esc_attr( sprintf( /* translators: %s: tool title */ __( '%s seç', 'flx-ai' ), $r['title'] ) ) );
		}

		$where = array();
		if ( $r['mcp'] ) {
			$where[] = 'MCP';
		}
		if ( $r['chat'] ) {
			$where[] = __( 'Sohbet', 'flx-ai' );
		}

		printf(
			'<tr data-tool data-src="%1$s" data-kind="%2$s" data-state="%3$s" data-conflict="%4$s" data-noprefix="%5$s" data-q="%6$s" class="%7$s">'
			. '<td class="flxai-col-sel">%8$s</td><td class="flxai-col-on">%9$s</td>'
			. '<td class="flxai-col-tool"><strong>%10$s</strong> <code>%11$s</code>%12$s<div class="flxai-desc">%13$s</div>%14$s</td>'
			. '<td class="flxai-col-src"><span class="flxai-src"><b>%15$s</b><code>%1$s</code></span></td>'
			. '<td class="flxai-col-kind">%16$s</td><td class="flxai-col-where">%17$s</td><td class="flxai-col-cap"><code>%18$s</code></td>'
			. '<td class="num">%19$s</td><td class="num">%20$s</td></tr>',
			esc_attr( $r['source'] ),
			$r['readonly'] ? 'read' : 'write',
			esc_attr( $state ),
			( $r['dupe'] || $r['rivals'] ) ? '1' : '0',
			$r['prefixed'] ? '0' : '1',
			esc_attr( $q ),
			$r['dupe'] ? 'is-dupe' : ( $r['off'] ? 'is-off' : '' ),
			$sel, // phpcs:ignore -- escaped above
			$toggle, // phpcs:ignore -- escaped above
			esc_html( $r['title'] ),
			esc_html( $r['name'] ),
			$alias, // phpcs:ignore -- escaped above
			esc_html( wp_trim_words( $r['description'], 30 ) ),
			'' !== $badges ? '<div class="flxai-badges">' . $badges . '</div>' : '', // phpcs:ignore -- escaped above
			esc_html( $r['label'] ),
			$r['approval'] ? '<span class="flxai-pill is-warn">' . esc_html__( 'değiştirir · onaylı', 'flx-ai' ) . '</span>' : '<span class="flxai-pill">' . esc_html__( 'okur', 'flx-ai' ) . '</span>',
			esc_html( $where ? implode( ' · ', $where ) : '—' ),
			esc_html( $r['cap'] ),
			esc_html( $s ? number_format_i18n( (int) $s['n'] ) : '—' ),
			esc_html( $s ? flxai_ms( (int) $s['avg_ms'] ) : '—' )
		);
	}
	if ( ! $rows ) {
		echo '<tr><td colspan="9" class="flxai-empty">' . esc_html__( 'Kayıtlı araç yok.', 'flx-ai' ) . '</td></tr>';
	}
	echo '<tr class="flxai-nomatch" hidden><td colspan="9" class="flxai-empty">' . esc_html__( 'Süzgece uyan araç yok.', 'flx-ai' ) . '</td></tr>';
	echo '</tbody></table></div>';
	echo '<div class="flxai-savebar"><button type="submit" name="do" value="save" class="button button-primary">' . esc_html__( 'Kaydet', 'flx-ai' ) . '</button><span class="flxai-note" data-dirty hidden>' . esc_html__( 'Kaydedilmemiş değişiklik var.', 'flx-ai' ) . '</span></div>';
	echo '</form>';
	echo '<p class="flxai-note">' . wp_kses(
		sprintf(
			/* translators: %s: link to Connected systems */
			__( 'Eklentiler araçlarını Flux AI SDK (<code>flx_ai_tool</code>) ya da <code>flx_mcp_tools</code> / <code>flxai_tools</code> filtreleriyle ekler. Aynı adı iki eklenti kaydederse ilk kaydeden açık kalır, diğeri kapalı bekler; "Bunu kullan" ile değiştirebilirsiniz. Eklenti ayarları: %s.', 'flx-ai' ),
			'<a href="' . esc_url( admin_url( 'admin.php?page=flx-ai-systems' ) ) . '">' . esc_html__( 'Bağlı sistemler', 'flx-ai' ) . '</a>'
		),
		array(
			'code' => array(),
			'a'    => array( 'href' => array() ),
		)
	) . '</p></div>';
}
