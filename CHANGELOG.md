# Changelog

## v0.0.10 - 2026-04-16

### Chores

- Fix Create GitHub Release step ([2635fed](../../commit/2635fed8c62075de1724ac0a5822f26f43ea529a))
- Update release workflow name dynamically ([e3c6da1](../../commit/e3c6da19a30aa7dad0a9c5e3adf4923c4573f925))

### Refactoring

- Changelog output ([6ba981c](../../commit/6ba981c6132efdc343fae5cb18fdfc860fb6e297))
- Sadly can't be updated dynamically ([cd9cf3b](../../commit/cd9cf3b05fc1c775973c3edbcd61eb920c2dc6d8))

## v0.0.9 - 2026-04-16

### Bug Fixes

- Fix QR payload race — fold queries into single useLiveQuery ([5a290a0](../../commit/5a290a06e3743370f0fae2e19e47cad46f0ab842))
- Use pull_request_target for dependabot automerge workflow ([16086c8](../../commit/16086c8c499f08388b6e01a35116023d79e77782))
- Add legacy-peer-deps again ([6349ed5](../../commit/6349ed55046d1b1bccb20bc7fcc3233a2bed7777))
- Run npm install --legacy-peer-deps ([e3adc92](../../commit/e3adc92a41937b5205f9394d81a5553ec3ec695b))
- Linter issue ([cdbaa99](../../commit/cdbaa9915dbb1f11e153679d79827e50f43839b6))
- Fix QR scan lint and typecheck errors ([cf4d9ed](../../commit/cf4d9ed4c36ef729fd5f9f78f532581e021e04da))
- Removed unused imports ([b225f0e](../../commit/b225f0e6790322f20b58e50c61b13ec4d97343d8))
- Lint and typecheck errors ([5a2386a](../../commit/5a2386a7f6a286ceb1fb6129743039896dd0dd3a))
- Resolve TS2769 tuple destructure in game-lifecycle test ([0b4b512](../../commit/0b4b512d191c902b46a6a32f5227489673e00043))
- Yaml indentation ([b8ef858](../../commit/b8ef858a0aace8c117fbd4f1b2ba0c0643cb6e6a))

### Chores

- Update eslint.config to ignore some folders ([e53378e](../../commit/e53378e813e0c83b8d42af531d4f962495cb3313))
- Bump the dev-dependencies group with 9 updates (#141) ([e35ccc6](../../commit/e35ccc6abb0bda3c76447f000e44145036f48435))
- Bump dependabot/fetch-metadata from 2 to 3 ([d0ea003](../../commit/d0ea003d2295a0a15f753b6b94423d4a728ebd99))
- Update dependencies ([8356254](../../commit/83562548d5e2250b8bc62d351ba276c59b1bab79))
- Add CI-driven release workflow ([1bff442](../../commit/1bff442f4e7cacf19518eb8955bfc8892ae1be91))
- Remove automerge workflow as it is always skipped ([1efa147](../../commit/1efa147a056b33872320fc64f99cf04e8f61ae67))
- Remove unnecessary workflow ([8c1e357](../../commit/8c1e35746c6b03d6d1a97e29c1fe973aa26f0ece))

### Features

- Bulk actions for player selection ([6eee621](../../commit/6eee6213e1a02ed0bd33e63e4dad6d05494fefbf))
- Add manual ci workflow dispatch ([5b4b03c](../../commit/5b4b03c3c57deeb511207626cdf1e818a99a342b))
- Player roster, team management, and away status ([5e5f083](../../commit/5e5f083bfccd830f746179a632f5505bf380f721))
- Player roster, team management, and away status ([00d1242](../../commit/00d1242b2de7996632c7c9c67ef0b399883c8d52))
- Team badges, icon picker, import from managed, join URL copy ([ee68f12](../../commit/ee68f126d183e8869383a5c8cd13a12cd132b347))
- Add useGameLifecycle hook for pause/resume/end ([502d890](../../commit/502d89065864dbfb1ec042ae804a1aa76189db7e))
- Pause/resume/end controls and reconnect sync ([8f235fc](../../commit/8f235fc40c0ef769b04e1920bb06eea6959b4aeb))

### Refactoring

- Change release gh workflow to manual ([2bfd820](../../commit/2bfd82021c8212e0b9f170bbb44e3e436427da34))
- Single workflow CI-driven release ([61099ba](../../commit/61099bac8fa78f8d2f5584c19ba1c86f3648cbeb))
- Single workflow CI-driven release ([a47ad7c](../../commit/a47ad7c0a71a9448cc22901bed2a6a0b0b527341))

### test

- Add game-lifecycle tests for pause/resume/end ([c6fd2c3](../../commit/c6fd2c38139d1da470b54857cf91bb7ea00134b2))

## v0.0.8 - 2026-04-11

### Bug Fixes

- Add --skip-if-exists to gh release create ([af8625d](../../commit/af8625d88a69ad613cd052abb13f1a23fd0adc6e))
- Fix automerge workflow trigger ([a67a9c7](../../commit/a67a9c793b2d5b4f4bf272310d53b190fa255646))
- Move libs to components ([ffa58b6](../../commit/ffa58b6371e268acf99c1809235c46651ca9692f))

### Chores

- Tighten PR and issue templates ([5d2b1b3](../../commit/5d2b1b3a2a93d75a09f4fa350a51381042bbc755))
- Bump basic-ftp from 5.2.1 to 5.2.2 ([81ef6ba](../../commit/81ef6babbbb66efe2762fa684841562c0caea951))
- Bump node to 24 in ci ([1db520b](../../commit/1db520bb5627f77bd6690a4ad8b2fc987a1955f1))
- Replace coverage artifact with summary script ([d0acca1](../../commit/d0acca1d4a736ae1e4519b6283eba9ef91706ae9))
- Add project-status.sh script for git-cliff status updates ([4b0d70c](../../commit/4b0d70cef4cffb8597bb01acac155eaa514bd065))
- Fix pack.sh permissions ([958af40](../../commit/958af40d4accf82b4d93370ea13924df3b3c6b5f))
- Remove reveal.js and gun from dependencies ([227b649](../../commit/227b6493f67889dccdccbd015fd03333a42b9c3c))
- Add bundle size check to CI ([b66ca44](../../commit/b66ca4401b8edbfd4c43b5871b99715936b3501f))
- Update package-lock.json ([86d11d9](../../commit/86d11d9531ed8531ddf1ef46f30b85887b8dc912))
- Add bundlesize2 ([5212bb7](../../commit/5212bb7564e81ad11fba51d448043ad333a83a9e))
- Optimise PWA icons with palette quantisation ([1200193](../../commit/1200193ca7887b068fa779c97893b8c90841eaa1))

### Features

- Skip tests when no code files changed ([8077677](../../commit/807767700886d7748ebf3b6f13c5d6a7f6120b3e))
- Add import/export Notes functions to db/snapshot.ts ([20ccb42](../../commit/20ccb42fd6891039e88442b9511d65eb16cee20d))
- Add import/export functionality to Notes page ([098d0ea](../../commit/098d0ea4287466fb886e6748a4073e1ebd816ade))
- Open notes directly via /admin/notes/:id ([a9e4977](../../commit/a9e497733c707ffeb0455758875d3ddf33757f8b))
- Add managed players, teams, and labels schema ([09195d4](../../commit/09195d480b9b9224a954f8405c27fb6826e99fd5))
- Label CRUD component and tests ([9050c7b](../../commit/9050c7b624ac22059d7a22085bd1532903385dbc))
- Player CRUD, page scaffold, and routing ([ce2dda1](../../commit/ce2dda1052c71d72012956f4444a21047542fa0b))
- Team CRUD component and tests ([7ec291f](../../commit/7ec291fb28e3151e38639bfe347b4583d068e515))
- Dual-pane management view ([91d2522](../../commit/91d252271a20aec854f27cdc74b5597457301320))

### Performance

- Lazy-load all routes in App.tsx ([02e56f1](../../commit/02e56f13292e13526517714ba81d6083b7dad493))
- Lazy-load PeerJS and GunTransport ([5225a19](../../commit/5225a1931ce3eeb0c1be5b76a4114ffb85eab293))

### Refactoring

- For smaller source tarballs ([3a76fae](../../commit/3a76faec04dce42c94c0ba30e109673bfe2f8f9d))

### test

- Add coverage thresholds and ci upload ([a22ca0c](../../commit/a22ca0cd3cd8038e98c0df78da87c7c9a1209fe9))
- Add coverage thresholds and coverage notes ([a15ce67](../../commit/a15ce67083164ff1a8a00c9d0e4349f6e3ba8e66))
- Remove lcov, add json and script to parse it ([da7e132](../../commit/da7e1327e2b73de11fc9cc6b62677452e3ee4293))
- Fix tryTransport test timing after dynamic import ([896c10d](../../commit/896c10df4ae65c35c595efde3dc8b196c552d10c))
- Add snapshot-notes test suite for importNoteFile / exportNote ([8505f2d](../../commit/8505f2d9071a3b9c2ccd2fe5066d7a462774a95d))

## v0.0.7 - 2026-04-10

### Chores

- Exclude archives and deploy folders from tests ([8826df4](../../commit/8826df4c50c18ea886832720440dceaac739dfe9))
- Remove docs workflow, docs are build in deploy.yml ([f6eff0f](../../commit/f6eff0f299be59eb9fd21ee2bb009e58e8fcde88))
- Fix git-cliff typo in release workflow ([2e638c8](../../commit/2e638c8e08b2a7ac77110f97df42fd75082990c1))
- Bump version and add lucide-react ([d947ca5](../../commit/d947ca51bbb4586dcab5a889d2d99a18ef0b6c59))
- Remove git-cliff installation, use npx ([ffc51f3](../../commit/ffc51f3d9bf5ca4c6e675aaf688f1fa5f2e0beef))

### Features

- Add Lucide React icon set across all screens ([1b89924](../../commit/1b899241d23e158edff7dea1468082f7d586b9f3))

## v0.0.5 - 2026-04-10

### Bug Fixes

- Install commitlint packages in lint-title before running ([a876318](../../commit/a876318d1475e02be9296873598ab87a0b17648e))
- Update Game and BuzzEvent fixtures for new buzzer schema fields ([1fc3621](../../commit/1fc36216a494871d6792a09c13abee654bf32c93))
- Replace Math.random() with crypto.getRandomValues() ([4424b02](../../commit/4424b02d26092998f54eaf887ede8658ab69610c))
- Use question difficulty score on adjudication ([7a0b7c4](../../commit/7a0b7c4cfd278c0556ec5428e7d15158f8feaaaf))
- Re-fire expiry notifications on each natural expiry (#84) ([354c1f3](../../commit/354c1f3a209c8d2b47330be92a2fa947e92744d9))
- Resume paused timer instead of resetting it (#86) ([1226583](../../commit/1226583a439eda3b9e5090a1473fb998a032781a))
- Make API docs browseable on GitHub Pages ([fe0cbb3](../../commit/fe0cbb3ae9df87073b61fa5d6ea3311a6a09b42d))
- Serve API docs via deploy.yml artifact instead of gh-pages branch ([61a0ca6](../../commit/61a0ca6fba922bc98854c63d897a54705ff6306f))

### Chores

- Update .gitignore to include archive and scripts ([2660246](../../commit/26602467101964aae868cfe0ec1adf43387fe94b))
- Add scripts folder to .gitignore ([e9bfe53](../../commit/e9bfe533f97ff4bfb505c3934c5065a37269f516))
- Add cache-dependency-path and align ci.yml with other workflows ([9e9dbd8](../../commit/9e9dbd8bf03fecd8babfb6e37831c514b270698c))
- Fix deploy/release collision and align all three workflows ([8676940](../../commit/867694050a7ba2e9ca83c55e0102613e525cdbd2))
- Bump basic-ftp from 5.2.0 to 5.2.1 ([ca614c4](../../commit/ca614c4a2fc8719e9560cc275e2367b33b7d8f79))
- Add branch protection script, Dependabot auto-merge, update PR template ([5045489](../../commit/5045489f1c93e2564d0211bb5f4dd3fb52c8c6c6))
- Expand commitlint scope-enum to match actual usage ([ac5d19f](../../commit/ac5d19f8655b308486fbf2ee6c9a718fe9d352fb))
- Add pr-title workflow and scope release notes to git-cliff ([01acae7](../../commit/01acae73de8abf194006b0c269af7f87283d61ee))
- Merge lint-title into CI workflow, fix git-cliff lockfile error ([34fef3f](../../commit/34fef3fb60b5521b9d213ee590f390105e609c6e))
- Trigger automerge on workflow_run instead of pull_request ([deeb1fa](../../commit/deeb1faa8906bcb7cd90fda5bf0d27a6ff57fbf4))
- Remove explicit pull_request types to fix check name mismatch ([0123e41](../../commit/0123e41e1f55fb7afe2b79d056150de7b62ceccd))
- Run prettier ([55c89ef](../../commit/55c89ef89984caf972396208c0ee97933c7e09b3))
- Add epic as commitlint type ([7e41ed6](../../commit/7e41ed66943c01e5e4f4110613b51cdff9861c46))
- Add docs to commitlint scope ([b1910a3](../../commit/b1910a3058d5a2951cea363827fc413a02dab873))
- Ignore archive and deploy folders for tests ([ca5659c](../../commit/ca5659c8d9df646bd0af7ca15e8bac35285036a5))
- Warn commit-lint scope instead of fail ([4683afa](../../commit/4683afa341ffd1a40640ce052c87243e9758d18c))
- Publish TypeDoc to GitHub Pages on push to master ([f2523ed](../../commit/f2523ed470d5825113acf1aa963dba4b3f4fc8f6))
- Update gitignore ([5a0b242](../../commit/5a0b24252f30bdbbfc08156c35fe89d65c331621))
- Remove docs and ci from commit types ([b5e11f1](../../commit/b5e11f13a1256ea34f2b9d4eba90b77b62b53b9f))
- Update package-lock.json ([b360ee9](../../commit/b360ee9d0278b886e33a06947aaa4a40116c76d2))

### Documentation

- Align CI/CD and release sections with actual tooling ([490ca27](../../commit/490ca27cc48b4c1ad5aa4807f11cc9f363fb4b0c))
- Rewrite CI/CD section to reflect current workflow setup ([47dc675](../../commit/47dc6758361a2c9b93a46cca8b27b897966f2e75))
- Note that scripts/ is gitignored and requires --force ([135bb05](../../commit/135bb051244ae997f125b4e8065d2fc0334c42b7))
- Update README for current project state ([08f91a4](../../commit/08f91a4a4289285ee4a75cfe5f8367c32ba6f1b5))
- Add TSDoc comments to transport layer ([5eb70ce](../../commit/5eb70cef1063f8f65f652b7990a3f8c56c7f224e))
- Add TSDoc comments to db schema and hooks ([aa0a22b](../../commit/aa0a22bc429675f4df95fce1764c61f86c66c4d7))
- Write host flow guide with examples ([448755b](../../commit/448755ba03343a3565c9ab3d86ca54fc39766757))
- Write player flow guide including offline QR scenario ([5ce7f03](../../commit/5ce7f03377a97276e18d3a8e968bd20fd61cbc0d))
- Write ADRs for existing architectural decisions ([1e0a213](../../commit/1e0a21311ffdc0db47e57530b7d5dfb4e723f91a))
- Fix npm run docs warnings ([d11ee30](../../commit/d11ee302a80bba202ef845aca815854c7f91140d))

### Features

- Add HostQuestionHeader with title, type and status badges ([c2e2654](../../commit/c2e2654fe7e67b2deee96c10c0db3ad751470350))
- Add HostQuestionAnswers with per-type rendering ([bb6e334](../../commit/bb6e33489deeb4399b086d7409dc34d6afdb588f))
- Add HostQuestionMedia for image/audio/video display ([538f44e](../../commit/538f44e9cc1eba8b9a9dd2daa605057b9c868956))
- Add visibility toggles and useGameVisibility hook ([e7c020b](../../commit/e7c020be0369acf41b496dfb8b0ba7978f618792))
- Compose HostQuestionPanel from sub-components ([f273aca](../../commit/f273aca83cdf1f687c387ef95b0934dd51c830e4))
- Nav sequence and position logic ([13aa513](../../commit/13aa5130cb3e90584b52005232381830db2f8c9a))
- UseNavigation hook — DB persist, SLIDE_CHANGE emit ([7fe0e5e](../../commit/7fe0e5e9b11fa9532648b2cf6a3b4c47c6fc2ca7))
- NavHeader — round label, Q counter, progress bar ([7f7f778](../../commit/7f7f77890bef99b6abce220ab0ec154a16c577f1))
- RoundBoundary — full-screen round transition overlay ([e88b982](../../commit/e88b9820d76d5457398d1e0c375707a9e9b86b59))
- UseKeyNav — arrow key navigation with modal guard ([0f74c35](../../commit/0f74c353b0fcd064a12a5a9df3e166e234dab032))
- Wire navigation into active game view ([c760494](../../commit/c7604944a0c0ea885dfc54326661d63f124bf2dc))
- Extend BuzzEvent and Game with buzzer config fields, add v4 migration ([a543f37](../../commit/a543f370ffc1afee5e8d1e8f09ece0bf377d17fb))
- Lock/unlock, false-start guard, adjudication, auto-lock, score emit ([06ab116](../../commit/06ab116402fe274556dedc45a6ce642cb0abfb69))
- BuzzerLockButton, BuzzList, BuzzerPanel GM components ([fc96ae3](../../commit/fc96ae3a872c945bfcd45cfb067d4b9e475d7b31))
- Wire BuzzerPanel, route BUZZ events, Space shortcut, clear on nav ([b5d5e8e](../../commit/b5d5e8e9d3708dd76007e96f5e9ab026ac65c75b))
- Add buzzer config toggles to game setup wizard ([f6c3201](../../commit/f6c320138f4cdc9fc348b3b4cf9359a218975611))
- Add useScoreboard hook ([7ab32f9](../../commit/7ab32f9108627f20988711b2c5e70dcd732e99b6))
- Add ScoreboardPanel component ([2ad1910](../../commit/2ad191014f658479adf4154b3bd6ea27f1154aff))
- Render ScoreboardPanel in active game view ([ffe228a](../../commit/ffe228ada779ef0fa380c047ec9e34fea20bf408))
- Host-controlled countdown with pause/resume and broadcast ([609a9dc](../../commit/609a9dc9e05601c473b51bf1370e13ec9ebedd0b))
- Audio/visual expiry cues and auto-reset on nav ([60efad3](../../commit/60efad36450922e29b88c76464fbf9d29d1cae27))
- Add Resume all bulk action (#85) ([cca673e](../../commit/cca673e087177b93e5ddc62026ac027876c4e30b))
- Add TypeDoc for automated API documentation ([cd62d6c](../../commit/cd62d6ca9b201ba45bf199b09637bad0f99ccbae))

### Refactoring

- Merge Pause all / Resume all into a single toggle button ([4a3e695](../../commit/4a3e6955eeb500922e8c63faca4beca5878d15f3))

### test

- Unit and integration coverage for buzzer epic ([293fc76](../../commit/293fc766c0accd3feae4a17c324088e160e5240e))
- Cover useGameVisibility non-Error rollback branch (#51) ([484f6d4](../../commit/484f6d47a48d5a032e47e2d4c497143f4e3d5f95))
- Cover importQuestions per-row catch path (#50) ([b99831b](../../commit/b99831b996efc94b71445e6078fb0fe759fad684))
- Cover DB v3/v4 upgrade callbacks (#49) ([16cab34](../../commit/16cab3452074b80ff575cc8b19486788f07d4750))
- Cover ManageTags validation, save-error, and keyboard paths (#48) ([81870de](../../commit/81870de340655da13a6968748d90abda500e1d4f))
- Cover ManageDifficulties drag-to-reorder, cancel, and keyboard paths (#47) ([7e3a951](../../commit/7e3a95117ac4c011d814ed060b4a698be59d09e5))
- Smoke tests for GunTransport and PeerJSTransport with mocked externals (#46) ([59b27f5](../../commit/59b27f52ca46250ecefbca070eaac3fa349109da))
- Fix act warning in ManageDifficulties order test ([8854158](../../commit/8854158d20e4093092492a15a6dfdbb18e2dd3b8))
- Fix tryTransport test timing by awaiting Peer instantiation ([8f5dad2](../../commit/8f5dad2b1fda85895a5715b31fbec3303cba4094))
- Cover remaining snapshot branches and PeerJS player send path ([61d6bf5](../../commit/61d6bf52e0a4b4be3df272824b1972ad74146ae9))
- Drop unreachable type-fallback test in snapshot-error ([b81b325](../../commit/b81b3259cbc17dcb054c166d2c5e4ec4c6618c9d))
- Add unit tests for scoreboard logic ([2909605](../../commit/29096058a0b12cd1044b768ba0afce278d75dd18))

## v0.0.4 - 2026-04-08

### Bug Fixes

- Enable GFM for table and strikethrough support ([26ff23f](../../commit/26ff23fee9d738ff3aa201fa03a116f35c4deffa))
- Constrain question form modal height, tighten layout ([98ea649](../../commit/98ea649cfb783a9f439864e401278ff30f80993e))
- Pin undici to >=6.24.0 to fix CVEs ([4626756](../../commit/46267560ba0e207232209161ce679a2452a48175))

### Chores

- Remove release-please-config.json ([0c457d9](../../commit/0c457d953d47f7d318ba13ea7cab947987374b33))
- Remove .release-please-manifest.json ([d9225c2](../../commit/d9225c2932aa3097e1bb76e150474819ad67839f))

### Features

- Add round rename and delete ([f951197](../../commit/f951197f09744c58e9d00299097bc00c6c8f2c21))
- Add manage categories and difficulties ([bc4a1fd](../../commit/bc4a1fd36f2c1926694b4b39a70ea03a9d03a3a7))
- Purge database action; fix double-seed guard ([017891f](../../commit/017891f21810afbba8bf7b02c7f149f97e0d9bed))
- Lobby — connection, QR code, player list, start ([edd0e18](../../commit/edd0e1890966e3b643b45fa11ca434508ad7fa8a))

### Refactoring

- Replace categories with tags; add tri-state tag filtering ([0c4305d](../../commit/0c4305d890dec89100fd7ad73edb4590b9c7ab78))

## v0.0.3 - 2026-04-07

### Bug Fixes

- Bump action versions to v6 and pre-create dist dir ([bc6bc80](../../commit/bc6bc8047681bb59e432639b81fbccae401fb3e9))

### Chores

- Skip deploy for non-app changes ([5c6e3f2](../../commit/5c6e3f2757fb2088c7ea209072880800f6bb1100))

### Features

- Collapsible admin sidebar, styled note markdown ([acceb10](../../commit/acceb105af730b8f2dfb753dffcdc0c37a4c5a1d))
- Theme switcher; fix sidebar collapse persistence ([e56a97d](../../commit/e56a97d5304bf68639e02cbd41e3195729157f67))

## v0.0.2 - 2026-04-07

### Features

- Implement Notes page with markdown viewer and editor ([a9d33cd](../../commit/a9d33cd1eb637a67258bb864be7f56b2cd1e101a))

## v0.0.1 - 2026-04-07

### Bug Fixes

- Switch favicon to PNG-only, remove SVG references ([bb2a0ca](../../commit/bb2a0ca8528423d2cd1156a3ed6dbff573025937))
- Resolve all 18 ESLint errors ([74fa80f](../../commit/74fa80f25c942cc2fadab61c034e9e2f9f38bdeb))
- Resolve tsconfig.test.json type resolution errors ([0585bcf](../../commit/0585bcf30879c14eef0c7824290ffceb2c085187))
- Compact game wizard Step 1 so buttons are always visible ([a5e0ae8](../../commit/a5e0ae84f68a42c39c8ee91043472c0e18d7d297))

### Chores

- Add full workflow suite and GitHub config ([c945eca](../../commit/c945eca828832c553bffda3740973da277bac79b))
- Fix reusable workflow trigger, release PAT, add pre-commit hooks ([b0336b1](../../commit/b0336b1a9e7013c486ec309a9d156c0339b48fa0))
- Opt into Node 24, fix favicon paths, update README ([d3cc1bc](../../commit/d3cc1bc54bcb05542377d26b7099af2193569091))
- Simplify workflows — merge CI into deploy, PRs-only for ci.yml ([1ff00f7](../../commit/1ff00f748f619399bf1ea89ed38eb4f8b9a9e162))
- Wire tests into deploy workflow and document testing setup ([a180498](../../commit/a180498006b3c593d64480ab9ddc47481c064c3f))
- Add Dependabot for npm and GitHub Actions ([271be31](../../commit/271be319caf3df5302f56f704a3f0f5b70f381bb))
- Bump actions/deploy-pages from 4 to 5 ([a57e547](../../commit/a57e5477cd8503bfb2c9eac9160f9456d1bff7df))
- Add CI workflow for PRs ([1051c61](../../commit/1051c610554add8b2c64766599ad0f117547cdd6))
- Bump actions/upload-pages-artifact from 3 to 4 ([44c951a](../../commit/44c951a17014c2776b001f3fa25c25be9c24dee4))
- Bump actions/checkout from 4 to 6 ([a12d183](../../commit/a12d1838376d22f69e896fa1e678e00dab1bef05))
- Bump actions/setup-node from 4 to 6 ([fe89c21](../../commit/fe89c2147426cc2d9365002894956e54eaab42f9))
- Add overrides for vite-plugin-pwa and serialize-javascript ([91c0cfd](../../commit/91c0cfd6a656e8712e8ec1a3cb9e0e1da322cfa1))
- Add pack.sh to build release tarball ([e0ab20a](../../commit/e0ab20a1d0f58496c51822f17bfb13c8492e104e))

### Documentation

- Add ci.yml to workflows table in README ([e0c783d](../../commit/e0c783da90fb2ce736623505b3589c5535eae3dc))

### Features

- Scaffold Viktorani PWA ([c88c3f1](../../commit/c88c3f1157bc2fba7212536a4183626a6cb37da6))
- Games page with 3-step creation wizard ([0787cc4](../../commit/0787cc47557cc49552e8963dd07cb7d343d5de17))
- Bulk JSON import/export with per-type examples ([16f88c1](../../commit/16f88c18213b339867a17ac748160c62c6f8eb16))
- Fuzzy search across all fields + select-all matched ([193d84d](../../commit/193d84d8b433523929b9e1bf993bc86b3ec3debb))
