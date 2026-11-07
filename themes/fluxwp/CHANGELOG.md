# Değişiklikler

## 0.7.11
- Hesabım: içerik bağlantı rengi artık düğmelere (`*btn*` sınıflı bağlantılar, ör. Flux Donate "Bağış yap") geçmiyor; boş "Bekleyen bağışlar" ekranındaki düğme yazısı zeminle aynı renk olup görünmez oluyordu.
- Hesabım genel temada nötr: telefon hatırlatması ve telefon alanı ipucu "fidan sertifikası" yerine genel bildirim metni; eklentilerin eklediği sekmelerin simgesi (menü ve pano kartı) fidan yerine nötr liste simgesi. Derneğe özel metin/simge ön ayardan: yeni filtreler `flx_phone_nudge_text`, `flx_phone_hint_text`, `flx_wc_endpoint_meta`; menü simgesi CSS değişkeni `--flx-wc-i-default`.

## 0.7.10
- Güvenlik (CodeQL): YouTube kimliği adrese `encodeURIComponent` ile girer.

## 0.7.9
- Güvenlik (CodeQL): YouTube oynatıcı yalnız geçerli video kimliğiyle yüklenir.

## 0.7.8
- Erişilebilirlik: yalnız simgeli arama düğmesi artık sunucu HTML'inde de adlı (`aria-label`). Interactivity API sunucuda `data-wp-bind--aria-label` değerini hesaplayamadığı için etiketi siliyordu; bağlama kaldırıldı, sabit etiket yazılır.
- Slider noktaları arasındaki boşluk 8px: dokunma hedefi Lighthouse "target-size" denetiminden geçer.
- CSS/JS sürüm eki tema sürümüyle aynı (önceden 0.7.1'de kalmıştı; güncellemeden sonra tarayıcı/LiteSpeed eski CSS'i gösterebiliyordu).
- Ödeme logoları `width`/`height` ile basılır (SVG'de width/height ya da viewBox, diğerlerinde dosya boyutu): yerleşim kayması ve "unsized-images" bulgusu yok.
- FluxWP imzası (flx-brand 1.1.1) koyu zeminde soluk değil; kontrast yeterli.

## 0.7.7
- Ödeme logoları (Görünüm › Tema Ayarları › Ödeme logoları): footer'daki ödeme/güven logoları artık seçilebilir. Ortam kütüphanesinden logo yükle, kaldır, sırala; hazır logolar iyzico bandı ve eklentilerin eklediği sanal POS logoları (Flux Donate: EsnekPOS). Hiç dokunulmadıysa otomatik: iyzico bandı + etkin sanal POS logoları. Renkli logolar koyu footer'da beyaz kutuda. Başka yere `[flx_odeme_logolari]`; filtre `flx_pay_logos_builtin`.

## 0.7.6
- Tarih ve "… önce" metinleri artık kullanıcının dilinde, tek ortak yardımcıdan (FluxWP `flx_date` / `flx_time_ago`, flx-brand 1.1.0): "31 minutes önce", "August 10" gibi Türkçe/İngilizce karışımı kalmadı; çekirdek dil paketi inmemiş olsa da TR ve EN ay/gün adları doğru.

## 0.7.5
- Varsayılan favicon: site simgesi ve kurum profili simgesi yoksa tema da yeni FluxWP favicon'unu (zeminsiz, beyaz konturlu işaret) gösterir; Flux SEO ya da Flux Admin kuruluysa onlarınki kullanılır, çift yazılmaz. Filtre `flx_theme_favicon`.

## 0.7.4
- Tema Ayarları kısmi yazımda diğer alanları korur: ön ayar, AI ya da sistem aracı yalnız bir alanı yazınca çerez banner'ı, animasyon ve kampanya kartı artık kapanmıyor (önceden formda olmayan onay kutusu "kapalı" sayılıyordu).
- Ayar şeması (`flx_settings_schema`): `flx_ayarlar` alanları ön ayar ve AI için tanımlı.

## 0.7.3
- Sistem Kontrolü: Flux SEO artık isteğe bağlı. Kurulu ya da etkin değilse hata yerine uyarı gösterilir.

## 0.7.2
- Sistem Kontrolü › Eklentiler artık site türüne göre: Flux Donate ve Flux Certificates yalnız bağış sitesinde (Flux Donate kurulu ya da Site türü "Bağış") gerekli; Flux Commerce kuruluysa mağaza sayılır ve Flux Commerce gerekli olur. İkisi de değilse (ör. fluxwp.com) bağış/mağaza paketleri istenmez, WooCommerce isteğe bağlıdır.
- Bağış sitesi değilse iyzico satırı gösterilmez; cron, saat dilimi ve SMTP uyarıları sertifika/bağış yerine genel dille yazılır.
- Yeni filtre `flx_sk_site_kinds` (array( 'donate', 'store' ) içinden).

## 0.7.1
- Footer alt satırında `flx/credit` bloğu (logo + "Altyapı: FluxWP", fluxwp.com). Blok Düzenleyici'de silinirse footer'ın en altına ince bir imza şeridi eklenir (`add_theme_support( 'flx-credit' )`).
- FluxWP imzası: Flux ekranlarının alt satırında küçük FluxWP logosu ve fluxwp.com bağlantısı. Ortak modül `inc/flx-brand` (kaynak FluxWP/fluxwp `tools/brand`); kurulu Flux paketlerinden en yeni sürümü bir kez yüklenir, `flx_brand_show` filtresiyle gizlenir.

## 0.7.0
- Yeni varsayılan renkler: antrasit düğmeler, mavi vurgu, açık bej sayfa zemini (yeşil yerine). Yeni palet rengi `base` (Sayfa zemini).
- Stil varyasyonları: Antrasit, Mavi, Petrol, İndigo, Orman (eski yeşil) (Görünüm › Düzenleyici › Stiller). Renkler aynı yerden tek tek de değiştirilebilir.
- CSS'teki sabit yeşil tonlar kaldırıldı: gölgeler, bantlar, video zemini, menü deseni ve koyu mod renkleri paletten türetilir. Paleti değiştiren her şey (stil, ön ayar, Site Editor) siteyi baştan sona boyar.
- Ön ayarlar türetilmiş tonları `settings.custom.color` (deep, band-mid, band-end, media, tint) ve `settings.custom.dark` (bg, surface, ink, text, primary, mint, mint-soft, line, link) ile sabitleyebilir. Antrasit koyu modda mavi düğme kullanır (`custom.dark.primary`).
- Palet adları genelleşti (Ana renk, Vurgu, Başlık…), slug'lar aynı.
- Demo ön ayarı (flux-demo 0.2.0) FluxWP logosu, koyu zemin logosu ve site simgesiyle kurulur.

## 0.6.0
- Tema `fluxwp` (FluxWP): genel, sade WooCommerce teması. Derneğe özel desenler, görseller, logolar, proje/etkinlik şablonları ve Site Kurulumu Örnek Preset ön ayar eklentisine taşındı.
- Yeni genel header, footer, ana sayfa (hero, özellikler, ürünler, yazılar) ve demo ön ayarı (4 ürün, sayfalar).
- Tema Ayarları › Ön ayarlar sekmesi (Flux Setup ekranı burada). Site türü: Mağaza / Bağış.
- Temayı taşı: eski temanın Site Editor kayıtları yeni temaya kopyalanır.
- Logo yoksa site adı gösterilir; logo kurum profilinden ya da `flx_logo_files` filtresinden.
- `#wc-*` link yer tutucuları; şablon ve desenlerde `[products]` kısa kodu; ürün ızgarası.
- Yeni filtreler: `flx_img_dirs`, `flx_i18n_domains`, `flx_search_placeholder`, `flx_search_chips`, `flx_account_cta`, `flx_logo_files`, `flx_tasi_sources`.
