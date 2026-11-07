<?php
/**
 * Ayarlar › Diller.
 *
 * @package flx-lang
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'admin_menu',
	function () {
		add_options_page( __( 'Diller', 'flx-lang' ), __( 'Diller', 'flx-lang' ), 'manage_options', 'flx-lang', 'flxl_settings_page' );
	}
);

add_filter(
	'plugin_action_links_' . plugin_basename( FLXL_FILE ),
	function ( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=flx-lang' ) ) . '">' . esc_html__( 'Ayarlar', 'flx-lang' ) . '</a>' );
		return $links;
	}
);

add_action(
	'admin_enqueue_scripts',
	function ( $hook ) {
		if ( 'settings_page_flx-lang' === $hook ) {
			wp_enqueue_style( 'flxl-admin', FLXL_URL . 'assets/css/admin.css', array(), FLXL_VERSION );
		}
	}
);

add_action(
	'admin_post_flxl_save',
	function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Bu işlem için yetkiniz yok.', 'flx-lang' ) );
		}
		check_admin_referer( 'flxl_save' );
		$result = flxl_save_settings( wp_unslash( $_POST ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- shared field-by-field validation.
		if ( is_wp_error( $result ) ) { wp_die( esc_html( $result->get_error_message() ), '', array( 'response' => 400 ) ); }
		wp_safe_redirect( admin_url( 'options-general.php?page=flx-lang&saved=1' ) );
		exit;
	}
);

function flxl_settings_page() {
	$s      = flxl_settings();
	$langs  = flxl_languages( true );
	$def    = flxl_default_language();
	$cat    = flxl_catalog();
	$geo    = flxl_geo_country();
	$fields = flxl_text_fields();
	?>
	<div class="wrap flxl-settings">
		<h1><?php esc_html_e( 'Diller', 'flx-lang' ); ?></h1>
		<?php if ( isset( $_GET['saved'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'Kaydedildi.', 'flx-lang' ); ?></p></div>
		<?php endif; ?>
		<p><?php esc_html_e( 'Varsayılan dil adreste önek almaz (example.org/hakkimizda/); diğer diller /en/ gibi önekle açılır. Her içeriğin dil sürümü ayrı bir sayfa/yazıdır: listede dil rozetinden ya da düzenleme ekranındaki Dil kutusundan oluşturulur. Tema ve eklenti arayüz metinleri kendi çevirileriyle gösterilir.', 'flx-lang' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="flxl_save">
			<?php wp_nonce_field( 'flxl_save' ); ?>

			<h2><?php esc_html_e( 'Diller', 'flx-lang' ); ?></h2>
			<table class="widefat striped flxl-langs">
				<thead><tr>
					<th><?php esc_html_e( 'Etkin', 'flx-lang' ); ?></th>
					<th><?php esc_html_e( 'Kod / adres', 'flx-lang' ); ?></th>
					<th><?php esc_html_e( 'Ad', 'flx-lang' ); ?></th>
					<th><?php esc_html_e( 'Bayrak', 'flx-lang' ); ?></th>
					<th><?php esc_html_e( 'WordPress dili', 'flx-lang' ); ?></th>
					<th><?php esc_html_e( 'Varsayılan', 'flx-lang' ); ?></th>
					<th><?php esc_html_e( 'Kaldır', 'flx-lang' ); ?></th>
				</tr></thead>
				<tbody>
				<?php foreach ( $langs as $code => $l ) : ?>
					<tr>
						<td data-label="<?php esc_attr_e( 'Etkin', 'flx-lang' ); ?>"><input type="checkbox" name="langs[<?php echo esc_attr( $code ); ?>][active]" value="1" <?php checked( $l['active'] ); ?> <?php disabled( $code === $def ); ?>><?php if ( $code === $def ) : ?><input type="hidden" name="langs[<?php echo esc_attr( $code ); ?>][active]" value="1"><?php endif; ?></td>
						<td data-label="<?php esc_attr_e( 'Kod / adres', 'flx-lang' ); ?>"><code><?php echo esc_html( $code === $def ? '/' : '/' . $code . '/' ); ?></code></td>
						<td data-label="<?php esc_attr_e( 'Ad', 'flx-lang' ); ?>"><input type="text" class="regular-text flxl-small" name="langs[<?php echo esc_attr( $code ); ?>][name]" value="<?php echo esc_attr( $l['name'] ); ?>"></td>
						<td data-label="<?php esc_attr_e( 'Bayrak', 'flx-lang' ); ?>"><input type="text" class="small-text" name="langs[<?php echo esc_attr( $code ); ?>][flag]" value="<?php echo esc_attr( $l['flag'] ); ?>"></td>
						<td data-label="<?php esc_attr_e( 'WordPress dili', 'flx-lang' ); ?>"><input type="text" class="flxl-small" name="langs[<?php echo esc_attr( $code ); ?>][locale]" value="<?php echo esc_attr( $l['locale'] ); ?>"></td>
						<td data-label="<?php esc_attr_e( 'Varsayılan', 'flx-lang' ); ?>"><input type="radio" name="default" value="<?php echo esc_attr( $code ); ?>" <?php checked( $code, $def ); ?>></td>
						<td data-label="<?php esc_attr_e( 'Kaldır', 'flx-lang' ); ?>"><?php if ( $code !== $def ) : ?><input type="checkbox" name="langs[<?php echo esc_attr( $code ); ?>][remove]" value="1"><?php endif; ?></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<p>
				<label for="flxl-add"><?php esc_html_e( 'Dil ekle', 'flx-lang' ); ?></label>
				<select id="flxl-add" name="add_lang"><option value=""><?php esc_html_e( '— seçin —', 'flx-lang' ); ?></option>
				<?php foreach ( $cat as $code => $c ) : ?>
					<?php if ( ! isset( $langs[ $code ] ) ) : ?>
						<option value="<?php echo esc_attr( $code ); ?>"><?php echo esc_html( $c['flag'] . ' ' . $c['name'] . ' (/' . $code . '/)' ); ?></option>
					<?php endif; ?>
				<?php endforeach; ?>
				</select>
				<span class="description"><?php esc_html_e( 'Yeni dil pasif eklenir: içeriği hazırlayıp sonra etkinleştirin. İngilizce dışındaki dillerde WordPress dil paketi de gerekir (Sistem kontrolü uyarır).', 'flx-lang' ); ?></span>
			</p>

			<h2><?php esc_html_e( 'İçerik', 'flx-lang' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><?php esc_html_e( 'Çevrilen içerik türleri', 'flx-lang' ); ?></th><td>
					<?php foreach ( get_post_types( array( 'public' => true ), 'objects' ) as $pt ) : ?>
						<?php if ( in_array( $pt->name, array( 'attachment', 'product' ), true ) ) { continue; } ?>
						<label style="margin-right:14px"><input type="checkbox" name="post_types[]" value="<?php echo esc_attr( $pt->name ); ?>" <?php checked( in_array( $pt->name, (array) $s['post_types'], true ) ); ?>> <?php echo esc_html( $pt->labels->name ); ?></label>
					<?php endforeach; ?>
					<p class="description"><?php esc_html_e( 'Sepet, ödeme ve hesabım sayfaları her dilde ortaktır. Kategoriler ortaktır; adları kategori düzenleme ekranında dil başına çevrilir. Görsellerin dile özgü alt metni ve farklı görseli medya düzenleme ekranında.', 'flx-lang' ); ?></p>
				</td></tr>
				<tr><th scope="row"><?php esc_html_e( 'Çevirisi olmayan içerik', 'flx-lang' ); ?></th><td>
					<label><input type="checkbox" name="fallback" value="1" <?php checked( ! empty( $s['fallback'] ) ); ?>> <?php esc_html_e( 'Diğer dillerde Türkçesini göster (menü ve arayüz o dilde kalır; arama motoruna kanonik Türkçe adres bildirilir)', 'flx-lang' ); ?></label>
					<p class="description"><?php esc_html_e( 'Kapalıysa İngilizce sitede yalnız İngilizcesi olan içerik listelenir.', 'flx-lang' ); ?></p>
				</td></tr>
				<tr><th scope="row"><label for="flxl-sw"><?php esc_html_e( 'Dil seçici', 'flx-lang' ); ?></label></th><td>
					<select id="flxl-sw" name="switcher">
						<option value="code" <?php selected( $s['switcher'], 'code' ); ?>>TR · EN</option>
						<option value="name" <?php selected( $s['switcher'], 'name' ); ?>>Türkçe · English</option>
						<option value="flag" <?php selected( $s['switcher'], 'flag' ); ?>>🇹🇷 · 🇬🇧</option>
					</select>
					<p class="description"><?php esc_html_e( 'Başka yere: "Flux Lang Seçici" bloğu ya da [flx_dil_secici] kısa kodu.', 'flx-lang' ); ?></p>
				</td></tr>
				<tr><th scope="row"><?php esc_html_e( 'Dil seçicinin yeri', 'flx-lang' ); ?></th><td>
					<label><input type="radio" name="switcher_place" value="footer" <?php checked( $s['switcher_place'], 'footer' ); ?>> <?php esc_html_e( 'Alt bilgi (footer)', 'flx-lang' ); ?></label><br>
					<label><input type="radio" name="switcher_place" value="header" <?php checked( $s['switcher_place'], 'header' ); ?>> <?php esc_html_e( 'Başlık (header) ve mobil menü', 'flx-lang' ); ?></label><br>
					<label><input type="radio" name="switcher_place" value="both" <?php checked( $s['switcher_place'], 'both' ); ?>> <?php esc_html_e( 'İkisi de', 'flx-lang' ); ?></label>
				</td></tr>
			</table>

			<h2><?php esc_html_e( 'Ziyaretçiye dil önerisi', 'flx-lang' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><?php esc_html_e( 'Türkiye dışından gelene', 'flx-lang' ); ?></th><td>
					<fieldset>
						<label><input type="radio" name="suggest" value="redirect" <?php checked( $s['suggest'], 'redirect' ); ?>> <?php esc_html_e( 'Direkt kendi dilinde aç (önerilen)', 'flx-lang' ); ?></label><br>
						<label><input type="radio" name="suggest" value="banner" <?php checked( $s['suggest'], 'banner' ); ?>> <?php esc_html_e( 'Sayfanın üstünde öneri bandı göster', 'flx-lang' ); ?></label><br>
						<label><input type="radio" name="suggest" value="off" <?php checked( $s['suggest'], 'off' ); ?>> <?php esc_html_e( 'Kapalı', 'flx-lang' ); ?></label>
					</fieldset>
					<p class="description"><?php esc_html_e( 'Türkiye dışından gelen ziyaretçi sayfa çizilmeden kendi dilindeki (yoksa İngilizce) sürüme açılır ve sonraki girişlerde de o dilde kalır. Dil seçicide başka dil seçen o dilde kalır. Arama motoru botları hiçbir zaman yönlendirilmez. Ülke Türkiye ya da saat dilimi Türkiye ise Türkçe kalır. Giriş yapmış kullanıcıya uygulanmaz; denemek için gizli pencere kullanın.', 'flx-lang' ); ?></p>
				</td></tr>
				<tr><th scope="row"><label for="flxl-to"><?php esc_html_e( 'Önerilen dil', 'flx-lang' ); ?></label></th><td>
					<select id="flxl-to" name="suggest_to">
						<?php foreach ( $langs as $code => $l ) : ?>
							<?php if ( $code !== $def ) : ?><option value="<?php echo esc_attr( $code ); ?>" <?php selected( $s['suggest_to'], $code ); ?>><?php echo esc_html( $l['name'] ); ?></option><?php endif; ?>
						<?php endforeach; ?>
					</select>
					<p class="description"><?php esc_html_e( 'Tarayıcı dili etkin dillerden biriyse (ör. Almanca eklendiğinde Almanca) o önerilir, değilse bu.', 'flx-lang' ); ?></p>
				</td></tr>
				<tr><th scope="row"><label for="flxl-hc"><?php esc_html_e( 'Türkçe gösterilen ülkeler', 'flx-lang' ); ?></label></th><td>
					<input id="flxl-hc" type="text" class="regular-text" name="home_countries" value="<?php echo esc_attr( implode( ', ', (array) $s['home_countries'] ) ); ?>">
					<p class="description"><?php esc_html_e( 'İki harfli ülke kodları (TR, CY…).', 'flx-lang' ); ?></p>
				</td></tr>
				<tr><th scope="row"><?php esc_html_e( 'Ülke bilgisi', 'flx-lang' ); ?></th><td>
					<?php if ( $geo['country'] ) : ?>
						<p><?php /* translators: 1: country code, 2: header name */ printf( esc_html__( 'Sizin isteğinizde ülke: %1$s (%2$s başlığı). Ülkeye göre öneri çalışır.', 'flx-lang' ), '<strong>' . esc_html( $geo['country'] ) . '</strong>', '<code>' . esc_html( $geo['source'] ) . '</code>' ); ?></p>
					<?php else : ?>
						<p><?php esc_html_e( 'Sunucu ülke bilgisi göndermiyor; tarayıcının saat dilimi kullanılır (Türkiye saati = Türkçe). Daha kesin sonuç için alan adını Cloudflare\'e bağlayın (ücretsiz plan, CF-IPCountry başlığı kendiliğinden kullanılır) ya da hosting\'in GeoIP başlığını açın.', 'flx-lang' ); ?></p>
					<?php endif; ?>
				</td></tr>
			</table>

			<?php
			$others = array_diff_key( $langs, array( $def => 1 ) );
			if ( $others ) :
				?>
				<h2><?php esc_html_e( 'Dile göre site metinleri', 'flx-lang' ); ?></h2>
				<p class="description"><?php esc_html_e( 'Boş bırakılan alan Türkçesiyle gösterilir.', 'flx-lang' ); ?></p>
				<table class="form-table flxl-texts" role="presentation">
					<?php foreach ( $others as $code => $l ) : ?>
						<tr><th colspan="2"><h3 style="margin:0"><?php echo esc_html( trim( $l['flag'] . ' ' . $l['name'] ) ); ?></h3></th></tr>
						<?php foreach ( $fields as $k => $f ) : ?>
							<?php
							$id  = 'flxl-t-' . $code . '-' . $k;
							$cur = flxl_text( $k, $code );
							$ph  = flxl_raw(
								function () use ( $f ) {
									$v = get_option( $f['option'] );
									return empty( $f['key'] ) ? (string) $v : (string) ( is_array( $v ) ? ( $v[ $f['key'] ] ?? '' ) : '' );
								}
							);
							?>
							<tr><th scope="row"><label for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $f['label'] ); ?></label></th><td>
								<?php if ( ! empty( $f['textarea'] ) ) : ?>
									<textarea id="<?php echo esc_attr( $id ); ?>" rows="2" name="texts[<?php echo esc_attr( $code ); ?>][<?php echo esc_attr( $k ); ?>]" placeholder="<?php echo esc_attr( $ph ); ?>" lang="<?php echo esc_attr( $code ); ?>"><?php echo esc_textarea( $cur ); ?></textarea>
								<?php else : ?>
									<input id="<?php echo esc_attr( $id ); ?>" type="text" class="large-text" name="texts[<?php echo esc_attr( $code ); ?>][<?php echo esc_attr( $k ); ?>]" value="<?php echo esc_attr( $cur ); ?>" placeholder="<?php echo esc_attr( $ph ); ?>" lang="<?php echo esc_attr( $code ); ?>">
								<?php endif; ?>
							</td></tr>
						<?php endforeach; ?>
					<?php endforeach; ?>
				</table>
			<?php endif; ?>

			<?php submit_button( __( 'Kaydet', 'flx-lang' ) ); ?>
		</form>
		<h2><?php esc_html_e( 'Yapay zekâ ile çeviri', 'flx-lang' ); ?></h2>
		<p><?php esc_html_e( 'Flux AI kuruluysa listede ve düzenleme ekranında "AI ile çevir" düğmesi çıkar. MCP ile bağlı AI ajanları (Claude vb.) ve Flux AI sohbeti şu araçları kullanır: flxl_languages, flxl_untranslated, flxl_translations, flxl_save_translation, flxl_set_language, flxl_image_language, flxl_term_translation, flxl_site_texts. Flux SEO araçlarında (list_content, create_content, update_content) lang parametresi var.', 'flx-lang' ); ?></p>
	</div>
	<?php
}
