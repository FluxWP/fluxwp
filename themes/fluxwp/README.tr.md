<div align="center">

[English](README.md) · **Türkçe**

# FluxWP

**Sade, hızlı bir WooCommerce block teması. Hero, header, footer ve ana sayfa block pattern ya da şablon parçası; ön ayarlar onu bambaşka bir siteye çevirebilir.**

![FluxWP](screenshot.jpg)

</div>

## İçinde ne var

- Sade mağaza düzeni: sayfa menüsü, arama, hesap ve sepetli header; hero; özellik kartları; son ürünler; blog yazıları; mağaza linkli footer.
- Birkaç nötr demo öğesi (dört ürün, hoş geldiniz yazısı, Hakkımızda ve İletişim sayfaları): **Tema Ayarları › Ön ayarlar**'dan *FluxWP: demo mağaza* ön ayarıyla eklenir.
- **Görünüm › Tema Ayarları**'nda site türü: *Mağaza* (varsayılan) ya da *Bağış* (sepet ve hesap metinleri bağışa döner).
- `#wc-shop`, `#wc-cart`, `#wc-checkout`, `#wc-account` link yer tutucuları WooCommerce sayfalarına çözülür.
- `[products]` kısa kodu şablon ve desenlerin içinde de çalışır.
- Karanlık mod, çerez bandı, sistem kontrolü, Türkçe ve İngilizce.

## Ön ayarlar

[FluxWP Panel](../../plugins/flx-setup/README.tr.md) etkinken **Görünüm › Tema Ayarları › Ön ayarlar** bir ön ayar (`flx-preset/1`) uygular: kurum profili, ayarlar, şablonlar, header, footer, desenler, sayfalar, ürünler ve menüler. Ön ayar tüm siteyi yeniden kurabilir; örneğin [FluxWP Extras](https://github.com/FluxWP/wp-extras) ön ayarları bu temayı dernek sitesine çevirir. Ön ayar güncellemeleri elle yaptığınız değişikliklerin üzerine yazmaz.

Ön ayar eklentileri için filtreler: `flx_presets`, `flx_img_dirs`, `flx_i18n_domains`, `flx_logo_files`, `flx_search_placeholder`, `flx_search_chips`, `flx_account_cta`, `flx_wc_endpoint_meta`, `flx_phone_nudge_text`, `flx_phone_hint_text`, `flx_tasi_sources`.

## Başka bir FluxWP temasından geçiş

Tema değişince Site Editor'de kaydedilmiş şablonlar, şablon parçaları, global stiller, tema ayarları ve özel CSS eski temadan kopyalanır (`flx_tasi_sources`). Var olan kayıtlar korunur. **Tema Ayarları › Eski temadan taşı** düğmesi tekrar çalıştırır.

## Gereksinimler

WordPress 6.6+, PHP 7.4+, WooCommerce, FluxWP Panel (kurulum sihirbazı temayla birlikte kurar).
