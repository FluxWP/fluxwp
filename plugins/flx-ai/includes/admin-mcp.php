<?php
/**
 * Flux AI & MCP › MCP: sunucuyu aç/kapa, anahtarlar, asistana bağlama ve son işlemler.
 *
 * @package FLX_AI
 */

defined( 'ABSPATH' ) || exit;

function flxai_page_mcp() {
	$uid = get_current_user_id();
	$new = get_transient( 'flxai_mcp_new_key_' . $uid );
	delete_transient( 'flxai_mcp_new_key_' . $uid );
	$url   = flxai_mcp_url();
	$keys  = flxai_mcp_keys();
	$log   = array_slice( (array) get_option( 'flxai_mcp_log', array() ), 0, 20 );
	$tools = flxai_mcp_tools();
	$on    = flxai_mcp_enabled();
	$state = flxai_admin_mcp_snapshot();
	$form  = function ( $do, $inner, $button, $class = 'button' ) use ( $state ) {
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" class="flxai-inline-form">';
		wp_nonce_field( 'flxai_mcp' );
		echo '<input type="hidden" name="revision" value="' . esc_attr( $state['revision'] ) . '">';
		echo '<input type="hidden" name="action" value="flxai_mcp"><input type="hidden" name="do" value="' . esc_attr( $do ) . '">' . $inner; // phpcs:ignore WordPress.Security.EscapeOutput -- callers escape
		echo ' <button class="' . esc_attr( $class ) . '">' . esc_html( $button ) . '</button></form>';
	};
	$slug     = sanitize_title( get_bloginfo( 'name' ) );
	$slug     = '' !== $slug ? $slug : 'fluxwp';
	$key_show = $new ? $new : __( 'ANAHTARINIZ', 'flx-ai' );
	$json     = wp_json_encode(
		array(
			'mcpServers' => array(
				$slug => array(
					'command' => 'npx',
					'args'    => array( '-y', 'mcp-remote', $url, '--header', 'Authorization:Bearer ' . $key_show ),
				),
			),
		),
		JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
	);

	flxai_page_head( 'MCP', __( 'Claude gibi yapay zekâ asistanları bu siteye MCP (Model Context Protocol) ile bağlanır. Araçları kurulu FluxWP eklentileri verir (SEO, CRM, Mail, Speed…); Flux AI sohbeti de aynı araçları kullanır.', 'flx-ai' ) );

	if ( flxai_mcp_legacy() ) {
		echo '<div class="notice notice-warning inline"><p>' . esc_html__( 'Eski Flux SEO sürümü kendi MCP sunucusunu çalıştırıyor. Flux SEO\'yu güncelleyin; anahtarlar ve ayar buraya kendiliğinden geçer.', 'flx-ai' ) . '</p></div>';
	}
	?>
	<div class="flxai-mcp">
		<section class="flxai-card">
			<h2><?php esc_html_e( '1. Sunucu', 'flx-ai' ); ?></h2>
			<?php
			$form( 'toggle', '<label class="flxai-check"><input type="checkbox" name="mcp_enabled" value="1"' . checked( $on, true, false ) . '> ' . esc_html__( 'MCP sunucusu etkin', 'flx-ai' ) . '</label>', __( 'Kaydet', 'flx-ai' ), 'button button-primary' );
			?>
			<p><?php esc_html_e( 'Sunucu adresi', 'flx-ai' ); ?>: <code><?php echo esc_html( $url ); ?></code>
				<span class="flxai-pill<?php echo $on ? ' is-ok' : ''; ?>"><?php echo $on ? esc_html__( 'açık', 'flx-ai' ) : esc_html__( 'kapalı', 'flx-ai' ); ?></span></p>
			<p class="flxai-note">
				<?php
				/* translators: %d: tool count */
				echo esc_html( sprintf( _n( '%d araç kayıtlı.', '%d araç kayıtlı.', count( $tools ), 'flx-ai' ), count( $tools ) ) );
				?>
				<a href="<?php echo esc_url( admin_url( 'admin.php?page=flx-ai-tools' ) ); ?>"><?php esc_html_e( 'Araçlar', 'flx-ai' ); ?></a>
			</p>
		</section>

		<section class="flxai-card">
			<h2><?php esc_html_e( '2. Anahtarlar', 'flx-ai' ); ?></h2>
			<p class="flxai-note"><?php esc_html_e( 'Asistan, anahtarı oluşturan kullanıcının yetkileriyle çalışır. Yeni içerikler taslak açılır, silme yalnız çöpe taşır.', 'flx-ai' ); ?></p>
			<?php if ( $new ) : ?>
				<div class="notice notice-success inline"><p><strong><?php esc_html_e( 'Yeni anahtar (yalnız şimdi gösterilir, kopyalayın):', 'flx-ai' ); ?></strong></p><p><code class="flxai-key"><?php echo esc_html( $new ); ?></code></p></div>
			<?php endif; ?>
			<?php
			$checks = '';
			foreach ( $tools as $name => $t ) {
				$checks .= '<label class="flxai-check"><input type="checkbox" name="tools[]" value="' . esc_attr( $name ) . '"> <code>' . esc_html( $name ) . '</code> '
					. esc_html( $t['title'] ) . ( empty( $t['readonly'] ) ? '' : ' <span class="flxai-pill">' . esc_html__( 'okur', 'flx-ai' ) . '</span>' ) . '</label>';
			}
			$scope = '<details class="flxai-scope"><summary>' . esc_html__( 'Araçları sınırla (isteğe bağlı)', 'flx-ai' ) . '</summary>'
				. '<p class="flxai-note">' . esc_html__( 'Hiçbiri seçilmezse anahtar kullanıcının bütün yetkileriyle çalışır. Seçilirse yalnız işaretli araçları görür ve çalıştırır (ör. TV sipariş paneli için yalnız order_summary).', 'flx-ai' ) . '</p>'
				. '<div class="flxai-scope-list">' . $checks . '</div></details>';
			$form( 'create', '<input name="name" placeholder="' . esc_attr__( 'Ör. Claude – Ahmet', 'flx-ai' ) . '" class="regular-text">' . $scope, __( 'Yeni anahtar oluştur', 'flx-ai' ), 'button button-secondary' );
			?>
			<?php if ( $keys ) : ?>
				<div class="flxai-tscroll"><table class="flxai-table">
					<thead><tr><th><?php esc_html_e( 'Ad', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Kullanıcı', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Araçlar', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Oluşturma', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Son kullanım', 'flx-ai' ); ?></th><th></th></tr></thead>
					<tbody>
					<?php foreach ( $keys as $id => $k ) : ?>
						<?php $u = get_userdata( (int) ( $k['user'] ?? 0 ) ); ?>
						<tr>
							<td><?php echo esc_html( $k['name'] ?? '' ); ?> <code>…<?php echo esc_html( $k['hint'] ?? '' ); ?></code></td>
							<td><?php echo esc_html( $u ? $u->user_login : '?' ); ?></td>
							<td><?php echo empty( $k['tools'] ) ? esc_html__( 'Tümü', 'flx-ai' ) : '<code>' . esc_html( implode( ', ', (array) $k['tools'] ) ) . '</code>'; ?></td>
							<td><?php echo esc_html( flx_date( (int) ( $k['created'] ?? 0 ), 'datetime' ) ); ?></td>
							<td><?php echo ! empty( $k['last_used'] ) ? esc_html( flx_time_ago( (int) $k['last_used'] ) ) : '—'; ?></td>
							<td><?php $form( 'revoke', '<input type="hidden" name="id" value="' . esc_attr( $id ) . '">', __( 'İptal et', 'flx-ai' ), 'button-link button-link-delete' ); ?></td>
						</tr>
					<?php endforeach; ?>
					</tbody>
				</table></div>
			<?php endif; ?>
		</section>
	</div>

	<section class="flxai-card">
		<h2><?php esc_html_e( '3. Asistana bağla', 'flx-ai' ); ?></h2>
		<p><strong>Claude Desktop / Cursor</strong> (claude_desktop_config.json › mcpServers):</p>
		<pre class="flxai-code"><?php echo esc_html( $json ); ?></pre>
		<p><strong>Claude Code</strong>:</p>
		<pre class="flxai-code">claude mcp add --transport http <?php echo esc_html( $slug . ' ' . $url ); ?> --header "Authorization: Bearer <?php echo esc_html( $key_show ); ?>"</pre>
		<p><strong>Claude.ai › <?php esc_html_e( 'Bağlayıcılar › Özel bağlayıcı ekle', 'flx-ai' ); ?></strong> — <?php esc_html_e( 'başlık eklenemeyen yerler için anahtarlı adres; kimseyle paylaşmayın:', 'flx-ai' ); ?></p>
		<pre class="flxai-code"><?php echo esc_html( add_query_arg( 'key', $key_show, $url ) ); ?></pre>
		<p class="flxai-note"><?php esc_html_e( 'Sunucu Apache ise ve "Geçersiz anahtar" hatası alırsanız .htaccess\'e SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1 ekleyin ya da anahtarlı adresi kullanın.', 'flx-ai' ); ?></p>
	</section>

	<?php if ( $log ) : ?>
	<section class="flxai-card">
		<h2><?php esc_html_e( 'Son işlemler', 'flx-ai' ); ?></h2>
		<div class="flxai-tscroll"><table class="flxai-table">
			<thead><tr><th><?php esc_html_e( 'Zaman', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Kullanıcı', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Araç', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Hedef', 'flx-ai' ); ?></th><th><?php esc_html_e( 'Sonuç', 'flx-ai' ); ?></th></tr></thead>
			<tbody>
			<?php foreach ( $log as $l ) : ?>
				<?php $u = get_userdata( (int) ( $l['u'] ?? 0 ) ); ?>
				<tr>
					<td><?php echo esc_html( flx_date( (int) $l['t'], 'datetime' ) ); ?></td>
					<td><?php echo esc_html( $u ? $u->user_login : '?' ); ?></td>
					<td><code><?php echo esc_html( $l['tool'] ); ?></code></td>
					<td><?php echo esc_html( $l['on'] ); ?></td>
					<td><?php echo $l['ok'] ? '<span class="flxai-pill is-ok">✓</span>' : '<span class="flxai-pill is-err">✗</span>'; ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table></div>
	</section>
	<?php endif; ?>
	</div>
	<?php
}
