# Changelog

## [0.0.7](https://github.com/morbeo/viktorani/compare/v0.0.5...v0.0.7) (2026-04-10)

### Features

- **ui:** add Lucide React icon set across all screens ([1b89924](https://github.com/morbeo/viktorani/commit/1b899241d23e158edff7dea1468082f7d586b9f3)), closes [#89](https://github.com/morbeo/viktorani/issues/89) [#90](https://github.com/morbeo/viktorani/issues/90) [#91](https://github.com/morbeo/viktorani/issues/91) [#92](https://github.com/morbeo/viktorani/issues/92) [#93](https://github.com/morbeo/viktorani/issues/93) [#94](https://github.com/morbeo/viktorani/issues/94) [#95](https://github.com/morbeo/viktorani/issues/95) [#96](https://github.com/morbeo/viktorani/issues/96)

## [0.0.6](https://github.com/morbeo/viktorani/compare/v0.0.5...v0.0.6) (2026-04-10)

### Features

- **ui:** add Lucide React icon set across all screens ([1b89924](https://github.com/morbeo/viktorani/commit/1b899241d23e158edff7dea1468082f7d586b9f3)), closes [#89](https://github.com/morbeo/viktorani/issues/89) [#90](https://github.com/morbeo/viktorani/issues/90) [#91](https://github.com/morbeo/viktorani/issues/91) [#92](https://github.com/morbeo/viktorani/issues/92) [#93](https://github.com/morbeo/viktorani/issues/93) [#94](https://github.com/morbeo/viktorani/issues/94) [#95](https://github.com/morbeo/viktorani/issues/95) [#96](https://github.com/morbeo/viktorani/issues/96)

## [0.0.5](https://github.com/morbeo/viktorani/compare/v0.0.4...v0.0.5) (2026-04-10)

### Features

- **admin:** nav sequence and position logic ([13aa513](https://github.com/morbeo/viktorani/commit/13aa5130cb3e90584b52005232381830db2f8c9a))
- **admin:** useKeyNav — arrow key navigation with modal guard ([0f74c35](https://github.com/morbeo/viktorani/commit/0f74c353b0fcd064a12a5a9df3e166e234dab032))
- **admin:** useNavigation hook — DB persist, SLIDE_CHANGE emit ([7fe0e5e](https://github.com/morbeo/viktorani/commit/7fe0e5e9b11fa9532648b2cf6a3b4c47c6fc2ca7))
- **admin:** wire navigation into active game view ([c760494](https://github.com/morbeo/viktorani/commit/c7604944a0c0ea885dfc54326661d63f124bf2dc))
- **buzzer:** lock/unlock, false-start guard, adjudication, auto-lock, score emit ([06ab116](https://github.com/morbeo/viktorani/commit/06ab116402fe274556dedc45a6ce642cb0abfb69)), closes [#37](https://github.com/morbeo/viktorani/issues/37) [#38](https://github.com/morbeo/viktorani/issues/38)
- **db:** extend BuzzEvent and Game with buzzer config fields, add v4 migration ([a543f37](https://github.com/morbeo/viktorani/commit/a543f370ffc1afee5e8d1e8f09ece0bf377d17fb)), closes [#37](https://github.com/morbeo/viktorani/issues/37)
- **docs:** add TypeDoc for automated API documentation ([cd62d6c](https://github.com/morbeo/viktorani/commit/cd62d6ca9b201ba45bf199b09637bad0f99ccbae)), closes [#76](https://github.com/morbeo/viktorani/issues/76) [#75](https://github.com/morbeo/viktorani/issues/75)
- **gamemaster:** render ScoreboardPanel in active game view ([ffe228a](https://github.com/morbeo/viktorani/commit/ffe228ada779ef0fa380c047ec9e34fea20bf408))
- **gamemaster:** wire BuzzerPanel, route BUZZ events, Space shortcut, clear on nav ([b5d5e8e](https://github.com/morbeo/viktorani/commit/b5d5e8e9d3708dd76007e96f5e9ab026ac65c75b)), closes [#39](https://github.com/morbeo/viktorani/issues/39) [#42](https://github.com/morbeo/viktorani/issues/42)
- **games:** add buzzer config toggles to game setup wizard ([f6c3201](https://github.com/morbeo/viktorani/commit/f6c320138f4cdc9fc348b3b4cf9359a218975611)), closes [#43](https://github.com/morbeo/viktorani/issues/43)
- **host:** add HostQuestionAnswers with per-type rendering ([bb6e334](https://github.com/morbeo/viktorani/commit/bb6e33489deeb4399b086d7409dc34d6afdb588f))
- **host:** add HostQuestionHeader with title, type and status badges ([c2e2654](https://github.com/morbeo/viktorani/commit/c2e2654fe7e67b2deee96c10c0db3ad751470350))
- **host:** add HostQuestionMedia for image/audio/video display ([538f44e](https://github.com/morbeo/viktorani/commit/538f44e9cc1eba8b9a9dd2daa605057b9c868956))
- **host:** add visibility toggles and useGameVisibility hook ([e7c020b](https://github.com/morbeo/viktorani/commit/e7c020be0369acf41b496dfb8b0ba7978f618792))
- **host:** compose HostQuestionPanel from sub-components ([f273aca](https://github.com/morbeo/viktorani/commit/f273aca83cdf1f687c387ef95b0934dd51c830e4))
- **scoreboard:** add ScoreboardPanel component ([2ad1910](https://github.com/morbeo/viktorani/commit/2ad191014f658479adf4154b3bd6ea27f1154aff))
- **scoreboard:** add useScoreboard hook ([7ab32f9](https://github.com/morbeo/viktorani/commit/7ab32f9108627f20988711b2c5e70dcd732e99b6))
- **ui:** add Resume all bulk action ([#85](https://github.com/morbeo/viktorani/issues/85)) ([cca673e](https://github.com/morbeo/viktorani/commit/cca673e087177b93e5ddc62026ac027876c4e30b))
- **ui:** audio/visual expiry cues and auto-reset on nav ([60efad3](https://github.com/morbeo/viktorani/commit/60efad36450922e29b88c76464fbf9d29d1cae27))
- **ui:** BuzzerLockButton, BuzzList, BuzzerPanel GM components ([fc96ae3](https://github.com/morbeo/viktorani/commit/fc96ae3a872c945bfcd45cfb067d4b9e475d7b31)), closes [#39](https://github.com/morbeo/viktorani/issues/39) [#40](https://github.com/morbeo/viktorani/issues/40) [#41](https://github.com/morbeo/viktorani/issues/41)
- **ui:** host-controlled countdown with pause/resume and broadcast ([609a9dc](https://github.com/morbeo/viktorani/commit/609a9dc9e05601c473b51bf1370e13ec9ebedd0b)), closes [#12](https://github.com/morbeo/viktorani/issues/12)
- **ui:** NavHeader — round label, Q counter, progress bar ([7f7f778](https://github.com/morbeo/viktorani/commit/7f7f77890bef99b6abce220ab0ec154a16c577f1))
- **ui:** RoundBoundary — full-screen round transition overlay ([e88b982](https://github.com/morbeo/viktorani/commit/e88b9820d76d5457398d1e0c375707a9e9b86b59))

### Bug Fixes

- **buzzer:** use question difficulty score on adjudication ([7a0b7c4](https://github.com/morbeo/viktorani/commit/7a0b7c4cfd278c0556ec5428e7d15158f8feaaaf))
- **ci:** install commitlint packages in lint-title before running ([a876318](https://github.com/morbeo/viktorani/commit/a876318d1475e02be9296873598ab87a0b17648e))
- **ci:** serve API docs via deploy.yml artifact instead of gh-pages branch ([61a0ca6](https://github.com/morbeo/viktorani/commit/61a0ca6fba922bc98854c63d897a54705ff6306f))
- **docs:** make API docs browseable on GitHub Pages ([fe0cbb3](https://github.com/morbeo/viktorani/commit/fe0cbb3ae9df87073b61fa5d6ea3311a6a09b42d))
- **tests:** update Game and BuzzEvent fixtures for new buzzer schema fields ([1fc3621](https://github.com/morbeo/viktorani/commit/1fc36216a494871d6792a09c13abee654bf32c93))
- **transport:** replace Math.random() with crypto.getRandomValues() ([4424b02](https://github.com/morbeo/viktorani/commit/4424b02d26092998f54eaf887ede8658ab69610c))
- **ui:** re-fire expiry notifications on each natural expiry ([#84](https://github.com/morbeo/viktorani/issues/84)) ([354c1f3](https://github.com/morbeo/viktorani/commit/354c1f3a209c8d2b47330be92a2fa947e92744d9))
- **ui:** resume paused timer instead of resetting it ([#86](https://github.com/morbeo/viktorani/issues/86)) ([1226583](https://github.com/morbeo/viktorani/commit/1226583a439eda3b9e5090a1473fb998a032781a))

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
