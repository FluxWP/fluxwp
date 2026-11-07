<div align="center">

**English** · [Türkçe](README.tr.md)

# FluxWP

**A simple, fast WooCommerce block theme. Every part of it (hero, header, footer, home page) is a block pattern or template part, so presets can turn it into a completely different site.**

![FluxWP](screenshot.jpg)

</div>

## What you get

- Clean store layout: header with page menu, search, account and cart; hero; feature cards; latest products; blog posts; footer with shop links.
- A few neutral demo items (four products, a welcome post, About and Contact pages) that you can add from **Theme Settings › Presets** with the *FluxWP: demo store* preset.
- Site type in **Appearance › Theme Settings**: *Shop* (default) or *Donation* (cart and account wording switch to donations).
- Link placeholders `#wc-shop`, `#wc-cart`, `#wc-checkout`, `#wc-account` resolve to WooCommerce pages.
- The `[products]` shortcode works inside templates and patterns.
- Dark mode, cookie banner, system check, Turkish and English.

## Presets

With [FluxWP Panel](../../plugins/flx-setup) active, **Appearance › Theme Settings › Presets** applies a preset (`flx-preset/1`): profile, settings, templates, header, footer, patterns, pages, products and menus. A preset can rebuild the whole site, for example a preset from [FluxWP Extras](https://github.com/FluxWP/wp-extras) turns this theme into an association site. Your own edits are never overwritten by preset updates.

Filters for preset plugins: `flx_presets`, `flx_img_dirs`, `flx_i18n_domains`, `flx_logo_files`, `flx_search_placeholder`, `flx_search_chips`, `flx_account_cta`, `flx_wc_endpoint_meta`, `flx_phone_nudge_text`, `flx_phone_hint_text`, `flx_tasi_sources`.

## Moving from another FluxWP theme

On switch, templates, template parts, global styles, theme mods and custom CSS saved in the Site Editor are copied from the old theme (`flx_tasi_sources`). Existing records are kept. The button **Theme Settings › Move from the old theme** runs it again.

## Requirements

WordPress 6.6+, PHP 7.4+, WooCommerce, FluxWP Panel (the setup wizard installs it with the theme).
