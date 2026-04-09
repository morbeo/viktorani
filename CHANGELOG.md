# Changelog

## [0.0.5](https://github.com/morbeo/viktorani/compare/v0.0.4...v0.0.5) (2026-04-09)

### Features

- **admin:** nav sequence and position logic ([13aa513](https://github.com/morbeo/viktorani/commit/13aa5130cb3e90584b52005232381830db2f8c9a))
- **admin:** useKeyNav — arrow key navigation with modal guard ([0f74c35](https://github.com/morbeo/viktorani/commit/0f74c353b0fcd064a12a5a9df3e166e234dab032))
- **admin:** useNavigation hook — DB persist, SLIDE_CHANGE emit ([7fe0e5e](https://github.com/morbeo/viktorani/commit/7fe0e5e9b11fa9532648b2cf6a3b4c47c6fc2ca7))
- **admin:** wire navigation into active game view ([c760494](https://github.com/morbeo/viktorani/commit/c7604944a0c0ea885dfc54326661d63f124bf2dc))
- **ui:** NavHeader — round label, Q counter, progress bar ([7f7f778](https://github.com/morbeo/viktorani/commit/7f7f77890bef99b6abce220ab0ec154a16c577f1))
- **ui:** RoundBoundary — full-screen round transition overlay ([e88b982](https://github.com/morbeo/viktorani/commit/e88b9820d76d5457398d1e0c375707a9e9b86b59))

## [0.0.4](https://github.com/morbeo/viktorani/compare/v0.0.3...v0.0.4) (2026-04-08)

### Features

- **gamemaster:** lobby — connection, QR code, player list, start ([edd0e18](https://github.com/morbeo/viktorani/commit/edd0e1890966e3b643b45fa11ca434508ad7fa8a)), closes [#1](https://github.com/morbeo/viktorani/issues/1)
- **questions:** add round rename and delete ([f951197](https://github.com/morbeo/viktorani/commit/f951197f09744c58e9d00299097bc00c6c8f2c21))
- **settings:** add manage categories and difficulties ([bc4a1fd](https://github.com/morbeo/viktorani/commit/bc4a1fd36f2c1926694b4b39a70ea03a9d03a3a7))
- **settings:** purge database action; fix double-seed guard ([017891f](https://github.com/morbeo/viktorani/commit/017891f21810afbba8bf7b02c7f149f97e0d9bed))

### Bug Fixes

- **deps:** pin undici to >=6.24.0 to fix CVEs ([4626756](https://github.com/morbeo/viktorani/commit/46267560ba0e207232209161ce679a2452a48175))
- **notes:** enable GFM for table and strikethrough support ([26ff23f](https://github.com/morbeo/viktorani/commit/26ff23fee9d738ff3aa201fa03a116f35c4deffa))
- **questions:** constrain question form modal height, tighten layout ([98ea649](https://github.com/morbeo/viktorani/commit/98ea649cfb783a9f439864e401278ff30f80993e))

## [0.0.3](https://github.com/morbeo/viktorani/compare/v0.0.2...v0.0.3) (2026-04-07)

### Features

- **settings:** theme switcher; fix sidebar collapse persistence ([273d7df](https://github.com/morbeo/viktorani/commit/273d7df5704cc767ce9698fa21f51a568e9f2b7e))
- **ui:** collapsible admin sidebar, styled note markdown ([1bfac18](https://github.com/morbeo/viktorani/commit/1bfac184ae6fbe21f4d3c20d5f78afa7c3f15fc0))

### Bug Fixes

- **ci:** bump action versions to v6 and pre-create dist dir ([979d92d](https://github.com/morbeo/viktorani/commit/979d92d2770b9233495ca02c684e855bef316e2b))

## [0.0.2](https://github.com/morbeo/viktorani/compare/v0.0.1...v0.0.2) (2026-04-07)

### Features

- **notes:** implement Notes page with markdown viewer and editor ([3aec72d](https://github.com/morbeo/viktorani/commit/3aec72dc33d1fa3d583ddf732d26dec58c21d890))

## 0.0.1 (2026-04-07)

### Features

- **admin:** Games page with 3-step creation wizard ([21fb8f1](https://github.com/morbeo/viktorani/commit/21fb8f159a5804e1cdcdc5a48a6e882f6d4e6869))
- **questions:** bulk JSON import/export with per-type examples ([26ed92c](https://github.com/morbeo/viktorani/commit/26ed92c640260025ea3183d32812b7e1bc3f6e8a))
- **questions:** fuzzy search across all fields + select-all matched ([74940bb](https://github.com/morbeo/viktorani/commit/74940bb95e0fb567648eead2b91a9eb395905037))
- scaffold Viktorani PWA ([7f935c4](https://github.com/morbeo/viktorani/commit/7f935c4d9d691a3c7d431db61b05de0d0316070e))

### Bug Fixes

- **lint:** resolve all 18 ESLint errors ([b89c026](https://github.com/morbeo/viktorani/commit/b89c02634fa81e8fbf5d1dd0e5478ab443b30c4c))
- **pwa:** switch favicon to PNG-only, remove SVG references ([bc72889](https://github.com/morbeo/viktorani/commit/bc72889d32e054e12d634d9a489785a487d7ef83))
- **test:** resolve tsconfig.test.json type resolution errors ([15bbc9a](https://github.com/morbeo/viktorani/commit/15bbc9a4ac392f7ff19ffe3c98114ba2a277f44c))
- **ui:** compact game wizard Step 1 so buttons are always visible ([5545bd2](https://github.com/morbeo/viktorani/commit/5545bd2f0aebd6654b6b6253915507d9b5a67a42))
