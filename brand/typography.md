# Typography
- Headings, timers, logo wordmark: **Alexandria** (500/700/800).
- Body/UI: **IBM Plex Sans Arabic** (400/500/600/700). Fallback: Cairo, system-ui.
- Scale: H1 `clamp(2rem, 7vw, 3.4rem)` / H2 1.25rem / body 1.0625rem (17px) / small 0.95rem. No Arabic text below 14px.
- Numbers: Western digits, `tabular-nums`, `dir="ltr"` + `unicode-bidi: isolate` for timers and codes.
- Loaded from Google Fonts in `index.html` (self-host later if you want offline/privacy).
