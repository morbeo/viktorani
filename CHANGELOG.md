# Changelog

## v0.2.0 - 2026-10-25

### Bug Fixes

- Tell players and screens when a timer is deleted (#505) ([57070c0](../../commit/57070c0909e516461cda7ff964d4400f0cb458d4))
- Award a question's points once when a buzz follows a ruling (#507) ([907e17e](../../commit/907e17eb449b04e4b45cb48ded02b88b8ccdd2dd))
- Wait for the local-network-only setting before approving a screen (#508) ([01350d3](../../commit/01350d364f260f5082677c9030da85e84ce8fbc8))
- Score a question again when it is replayed in a later round (#509) ([6d637e0](../../commit/6d637e01bbbcdda858d808aa8b75f3981d2dcdcd))

### Chores

- Standardize workflows and fix dependabot auto-merge (#492) ([4415899](../../commit/44158992600452bbc4a17499b719b313db78a5ba))
- Bump lucide-react (#494) ([bf8b06d](../../commit/bf8b06d944bab5c9ee143667ff695a93b9d9bc8d))
- Bump fake-indexeddb (#493) ([b57561e](../../commit/b57561e77b53ab8c15f8187b58f9edeb5098a318))
- Bump markdown-it from 14.3.2 to 14.3.3 (#511) ([9a01375](../../commit/9a01375422c3279e8c1ba011f7214025834d2e19))
- Bump undici from 7.30.0 to 7.30.1 (#526) ([f0b6b9f](../../commit/f0b6b9f81ec66480fb8d3d1ec88936da23645ed3))
- Bump serialize-javascript from 7.0.5 to 7.1.4 (#527) ([8355340](../../commit/8355340d1c6c38578390d3c66fcb2c3972849c89))

### Features

- Deploy after auto-merging production dependency updates (#495) ([101d66f](../../commit/101d66f9e709b905fc5fbd3e66ce2927904171de))
- Limit a game to devices on the local network (#496) ([efcde0d](../../commit/efcde0dc18a1ebb3bd67cc3aa872274c5bd2c9bf))
- Flag players who leave the game screen (#497) ([5886540](../../commit/5886540e3cf98c4c1773538a3ee3ff688629267b))
- Let players type answers to open-ended questions (#498) ([ccffbe5](../../commit/ccffbe5dad8d3b947146c98c5d039b33734c6f24))
- Show widget previews in the layout designer (#504) ([ab66bc1](../../commit/ab66bc1b4c9539487df5a9a9d3be516554ed5702))
- Open a scoreboard window for the scoreboard surface (#510) ([244430e](../../commit/244430e060af98b03b2b538f9fe0a1dc7495a1f3))
- Show the scoreboard surface on remote devices (#513) ([a5e45b6](../../commit/a5e45b6fe08ba7c42b290cece82f21db04bb327f))
- Put every question of the round on phones (#514) ([d8e4aef](../../commit/d8e4aef2bc1eb2d9670e784d44f2338b24217cc1))
- Show the scoreboard between rounds (#516) ([e870fb7](../../commit/e870fb777440850a3e20812a389b5d8acd0d190f))
- Replace import with a removal preview (#524) ([bf33309](../../commit/bf3330918a82104e72898c62151df6c513e224dc))
- Viktorani-mcp authoring server (#525) ([70b5004](../../commit/70b50043dd60329eef92127598fad76d2cd7f9d2))

### test

- Cover least-tested settings, roster and game log code (#506) ([b8eb457](../../commit/b8eb4570f484b3ad0685cacdec499ced025ec0e8))

## v0.1.0 - 2026-10-20

### Bug Fixes

- Resolve react-hooks/set-state-in-effect and refs errors ([48d62a3](../../commit/48d62a3b7c899345f1aee5a66ffda60cea37b43c))
- Fix failing test ([d48c95d](../../commit/d48c95de405a03ae24b5d5dad53b8dfc0f2093cd))
- Use jest-dom vitest entry for vitest 5 matcher types ([288a02a](../../commit/288a02ab6d47e1fccbfd83a73dd5c3471c260916))
- Navigate rounds in game order (#281) ([8902a7d](../../commit/8902a7d5300dedfa8ee466c8eca2e2fc6e04e488))
- Reflect lock state in the UI and fix points lookup (#280) ([151f585](../../commit/151f585858adb7cacd8d1c05a1dfcee6a97cec7e))
- Apply navigation auto-reset to local timer state (#283) ([1ab0e92](../../commit/1ab0e92fb7c55032d63c6c9d48cb923a900bc9cc))
- Make adjudication idempotent and atomic (#284) ([09deba7](../../commit/09deba79c2b82d3a287c0d080028344c150727e7))
- Replace the window buzz bridge with a ref cleared on unmount (#287) ([7869e89](../../commit/7869e896a9fe03ec854afd145d85908d88e76093))
- Keep the scoreboard live and store team scores separately (#289) ([7d1325e](../../commit/7d1325e8b4d4d026ee1359e940559a2235ef6566))
- Preserve buzz history across questions and scope it to the game (#290) ([8809155](../../commit/880915527bb08d9e11d9f82c88605ab148ef952c))
- Make game create/clone/delete atomic and block zero-question games (#291) ([db3a04c](../../commit/db3a04caf21f40be1a1c756915aea3f28072cfb3))
- Bump react-router to patch the RSC CSRF advisory (#296) ([6333c5f](../../commit/6333c5fcb092f5eb98d7c555c8c59edbf0edaa49))
- Move the Dexie schema version forward past the old v4 (#297) ([59ce318](../../commit/59ce3181ea1d790a6294569da10f9362b5ddd12d))
- Remove script injection and repair the release step (#295) ([6579e7e](../../commit/6579e7ee392dc701381e6eb0dcb6d66424edf3df))
- Align change detection with deploy paths (#299) ([a3f97d4](../../commit/a3f97d4a678fb670006112c9a7d81c2cce5dcffd))
- Merge game state patches so lock and pause don't overwrite each other (#294) ([a757a15](../../commit/a757a15691266ce3ed740c89f874c790ff1aa84f))
- Broadcast timer resets to players (#301) ([668d0a8](../../commit/668d0a8cc92096b16fe79a885e8356210e04630b))
- Validate JSON imports with zod and write them in one transaction (#300) ([aabf856](../../commit/aabf856cd22958bd548bdcc815738337f6fe57bf))
- Send current player and team scores in GAME_STATE (#302) ([570198a](../../commit/570198a14a8f452decb212936fc42083d0302ea2))
- Ignore unknown stored control sizes (#317) ([ebbe912](../../commit/ebbe9129f03106f322238f1d7493b8130a449596))
- Send host broadcasts only to admitted players (#324) ([68a3236](../../commit/68a3236f20e01b2dd94994a98a48b537ed3ce323))
- Refuse connections to a player's peer (#328) ([8380bc2](../../commit/8380bc211e6078fb7d0053fafc3a41edf1edb7f7))
- Keep player connections out of the screen queue and cap waiting requests (#329) ([bd70fe4](../../commit/bd70fe43cbad2d85f2079ee5a4f328a0a45b2897))
- Drop Reveal.js from the manifest description (#330) ([a9beffa](../../commit/a9beffa349bde3e0e90a5764e2e94eb11bee358d))
- Keep an ended game offline (#347) ([3cd2893](../../commit/3cd28933d99b14304a11d4ae366a15e45504b342))
- Mint fresh ids when importing the managed roster (#348) ([2b42f8c](../../commit/2b42f8cde287acdf737662dcdcaf83da13c33bb0))
- Release a peer that is still connecting on disconnect (#349) ([5585b53](../../commit/5585b53015e62df6a059ae88d4e472ae786ea466))
- Include game questions in backups (#350) ([e5445da](../../commit/e5445daebd916db1adb1939c15241031e9131473))
- Follow the host's pause and end of game (#351) ([0650af1](../../commit/0650af119688b8aade5542f9548d7bf1ff17183a))
- Honour the timer's player notifications on expiry (#352) ([c350999](../../commit/c350999e3e4a6fb7a007858ce2478d52f5ff4ab4))
- Send running timers to late joiners and new screens (#353) ([32149bf](../../commit/32149bfc6af70f87edfe653767e84596b7223948))
- Record each question's result (#354) ([6006b7a](../../commit/6006b7a42f862c22328cd1c5e7e83c60cf7dee71))
- Record the buzzer's team with each buzz (#366) ([53d284f](../../commit/53d284fbfe48c4054e472c244d76b5503ee68f19))
- Don't admit a connection that closed while queued (#367) ([7b49903](../../commit/7b499038691355bd605448d71ea3b4b8f507b6c3))
- Log a failed away write for a connection closed while joining (#372) ([f23292b](../../commit/f23292b6438fa463a4c4f73a6070b4c0f1444281))
- Show why a player is not connected (#373) ([039567c](../../commit/039567ce17d5f108de3f37b5ced4a91de5aa82cb))
- Bound typed scores and ignore NaN in set (#383) ([4f75452](../../commit/4f75452584029477ecbf8b6bf12a519acb818160))
- Keep a kick in force after the host reloads (#392) ([6bbdb54](../../commit/6bbdb540e63dbcab2efe38509d58352b7d4531c1))
- Cap tab-switch entries per player in the game log (#398) ([0eab1bf](../../commit/0eab1bfae50736deaf8559a20d1d98e8e2ece81d))
- Keep help tooltips from being clipped by modals and scroll areas (#400) ([8d3689c](../../commit/8d3689c7b6181e7b404fbed874ab4da6c4de7159))
- Override argparse under bundlesize2 to drop sprintf-js (#443) ([884426d](../../commit/884426d0187e051686a3598935e8dcd734f0b027))
- Publish the api reference, refresh docs and propose mcp support (#450) ([ec4f834](../../commit/ec4f8340aedd62f4bdd2cb5043db9e54dcea1b38))
- Let /api without a trailing slash reach the api docs (#453) ([f694c94](../../commit/f694c947122510f283fa0bd86c1f0ce7eee0be1e))
- Keep held scores on the host's projector window (#488) ([80fcddf](../../commit/80fcddf420256e71f9016ad22f4974ba1e3462f2))
- Prepend release notes instead of regenerating the changelog (#489) ([4fcb81f](../../commit/4fcb81fe80491fcb42d52bc5c1fd25803af1009e))

### Chores

- Bump the production-dependencies group with 2 updates ([4a608a8](../../commit/4a608a8cd3e67c042480c0ffbf0d6c8c2b7edab0))
- Bump the dev-dependencies group across 1 directory with 11 updates ([c3709d3](../../commit/c3709d3a1f5016815d6c47ba89e943e03144dfab))
- Update package-lock ([f6b6177](../../commit/f6b6177c08f12049e81f59dc7cb4ea4c8c6051fa))
- Exclude e2e directory from vitest ([1d968bd](../../commit/1d968bdc88ccd8169e0e7df099a0ede864f3d325))
- Remove e2e CI workflow — local-only ([3d14947](../../commit/3d149479c5c6e1b37a5ee55a7855e9d66b1f247a))
- Remove firefox testing ([7d230f8](../../commit/7d230f8b76d6228ab0fccb84e94c4fd16f6eefed))
- Add playwright folders to gitignore ([def590d](../../commit/def590d94edcd6773a5f8d9c7c99fbb3d4b36c11))
- Exclude playwright folders from pack.sh ([01426fa](../../commit/01426fa7efa6bc94f08d7df29ecac6ae45dbc043))
- Update package-lock.json ([e73ecf1](../../commit/e73ecf136f0cbda022f146a36b843ae9d3b7e1d9))
- Bump fast-uri from 3.1.0 to 3.1.2 ([a96a017](../../commit/a96a017c2afe7305f467f9122ab8cc4f8509aa5b))
- Bump @babel/plugin-transform-modules-systemjs ([c8502ea](../../commit/c8502ea076ba92e9d28dfa8b92bed8e2faf12aa7))
- Bump the production-dependencies group across 1 directory with 4 updates ([822eb7c](../../commit/822eb7c6eb7ad41f082608d62ea8fafcc1615b63))
- Bump the dev-dependencies group across 1 directory with 16 updates ([6cd7b1f](../../commit/6cd7b1f1dfafe7af829da95981e676b6e14a0885))
- Bump the production-dependencies group across 1 directory with 6 updates ([1529f8d](../../commit/1529f8da1d0e60d8babd16555ee82fe0ed1b59c7))
- Bump lucide-react in the production-dependencies group ([83ce7ad](../../commit/83ce7ad49ff8e1f592a22e20b9c13da0aa6f92ae))
- Bump vite from 8.0.13 to 8.0.16 ([02525bc](../../commit/02525bc368e6460dfb6b54a0eb573b0e4dc098b2))
- Bump markdown-it from 14.1.1 to 14.2.0 ([e2e241a](../../commit/e2e241aed0ba86023eb3cfafab09a0135b4acedc))
- Bump actions/checkout from 6 to 7 ([574ac89](../../commit/574ac89ca820e4d2f25cb5becfeffc14c52c0652))
- Bump the production-dependencies group across 1 directory with 6 updates ([e28fe1f](../../commit/e28fe1faa69b801f96b8c151354923173bd325ea))
- Bump the dev-dependencies group across 1 directory with 18 updates ([07a9dc3](../../commit/07a9dc3d12f74824769d763f1aa8192d9414c447))
- Bump baseline-browser-mapping from 2.10.19 to 2.11.23 ([7c4c994](../../commit/7c4c9948da4a6d345cc12289171c7a08f8d30bfd))
- Bump @babel/core from 7.29.0 to 7.29.7 ([5bcf2d9](../../commit/5bcf2d9f29c847d31de12634b6b08e50f35fbd9d))
- Bump undici from 7.25.0 to 7.29.1 ([2123ae8](../../commit/2123ae8d6627104cfab0d18449c154c36ea5a255))
- Bump js-yaml ([6a2482e](../../commit/6a2482ee9f6dbc9fe25a393a47e6dcfc63aeffa5))
- Bump @humanfs/node from 0.16.7 to 0.16.8 ([6d3b58f](../../commit/6d3b58f162e33c34819af8bcfc3f2a26d5b16060))
- Bump fast-uri from 3.1.2 to 3.1.7 ([3add46a](../../commit/3add46a49264c824012017e68aa9afbf9d0a602a))
- Bump brace-expansion from 2.1.0 to 2.1.4 ([0cb6e48](../../commit/0cb6e48c2cb683419d5b2a765a40ccf31dbbd878))
- Bump browserslist from 4.28.2 to 4.29.3 ([acf6a3b](../../commit/acf6a3baf68712128303d8344e246793d8515a66))
- Bump undici from 7.29.1 to 7.30.0 ([0ebbc75](../../commit/0ebbc75326e8863bfdf6d7a5fd0ef47a8df3c18a))
- Bump fast-uri from 3.1.7 to 3.1.8 ([404194e](../../commit/404194e2f2fc8236ec4c708081f88f4123871de3))
- Bump brace-expansion from 2.1.4 to 2.1.7 ([52ecb43](../../commit/52ecb4386f6361e87aea59e940559c1d38ecefee))
- Bump actions/setup-node from 6 to 7 ([4e6d8e9](../../commit/4e6d8e9500ddf9e60cf7511b0e59473446e860e7))
- Bump vitest from 4.1.11 to 5.0.2 (#235) ([b3141ad](../../commit/b3141adb1235f7e024e45a3a78165aeee4bbf03a))
- Bump brace-expansion from 5.0.5 to 5.0.12 (#238) ([b0f2b23](../../commit/b0f2b2397d71c9dd4918a1889c60059204039957))
- Add Claude Code subagents and project roadmap (#241) ([ba7949e](../../commit/ba7949e10315f6551e7a39ff90c66044cef362b5))
- Link roadmap to epics, record player-side decisions, teach pm agent epic history (#264) ([79a42c0](../../commit/79a42c09568c58544a8965db21a8c06f84297672))
- Link Phase 3 roadmap items to issues (#279) ([4e007bd](../../commit/4e007bd75368f87363e002ae8bf1b67a9391a4be))
- Correct the GameQuestion.order doc comment (#286) ([ffe0ab7](../../commit/ffe0ab738d113e1a36e591c9607ef1de6657399f))
- Remove unused deps, refresh README, keep note text on import (#303) ([f292ec8](../../commit/f292ec892f16ff2150f1a67a6cdfa5a783dd5c73))
- Add a security agent that gates PR merges (#304) ([d4f7d15](../../commit/d4f7d15b2c08ebecb8d719000064fc5c2f27d5c8))
- Tick completed roadmap items (#308) ([2556360](../../commit/2556360ae25b91e973e573b8f07b3ec64b5169c8))
- Add an architecture guide with diagrams (#313) ([0959cfb](../../commit/0959cfb5c4b10445fbb7b07de58cafbe44c5026f))
- Tick the finished Phase 3 items in the roadmap (#327) ([89c6a58](../../commit/89c6a5808111c9ae04b5d96ba5f0ce5e3ea7fe76))
- Match the guides and README to current behaviour (#369) ([78f6ccf](../../commit/78f6ccfe7629345d9a4a71624d1553a4b4b10d2e))
- Bump the dev-dependencies group with 7 updates (#403) ([f30c7d7](../../commit/f30c7d79592ab773f8fffcef1a40c5197fcb8afd))
- Bump the production-dependencies group across 1 directory with 4 updates (#404) ([a3f77ae](../../commit/a3f77ae7938f74c6d72be269cfd74203e7f48165))
- Bump the dev-dependencies group with 3 updates (#436) ([c666f05](../../commit/c666f0571a96b02f0332da21444be08d622e42d7))
- Bump the production-dependencies group with 2 updates (#437) ([e61fc50](../../commit/e61fc50f5ae5920ec1c3a1658a9e932600215473))
- Sync roadmap with merged phase 6 work (#438) ([0386f25](../../commit/0386f25f6741d0d05475ac7b41659255f454530c))
- Propose theming for colours, fonts, icons and logos (#451) ([00f54c3](../../commit/00f54c36d42b9c7fbbbe27adc8a9fe311bb55d06))
- Bump the dev-dependencies group with 5 updates (#471) ([d484e9e](../../commit/d484e9e56a52fdb3ea48e6a357c3ac797a6cc648))
- Bump the production-dependencies group with 4 updates (#472) ([a92e532](../../commit/a92e532dc5c95d1a3c6ed2bffd3a9cb4b718c296))

### Features

- Add npm run demo to seed a ready-to-play demo game (#240) ([5f85f88](../../commit/5f85f8824d8872de9d876f4a867d56696d505627))
- Add size limits to transport message schemas (#293) ([f88e687](../../commit/f88e6876801f9c05ec8f707e0c97efc5ace8ffb0))
- Add a Content Security Policy (#298) ([77c2119](../../commit/77c21194f7ca5e7717a574d449676e45a9180c1d))
- Add a hidden debug panel to Settings (#306) ([7b16bfd](../../commit/7b16bfd9221c865a8bcf3b47be3f3a45954c71f3))
- Load demo data from the Settings debug panel (#309) ([985e2f3](../../commit/985e2f3e4fcd97675d0cde8786ca1c40bb71bb4d))
- Add join policy settings to games (#311) ([e33d19a](../../commit/e33d19abdd9d6205d55818e9f46ba3b936db9686))
- Bind players to their connection and add join, lobby and question messages (#310) ([971a9b7](../../commit/971a9b71d125b4c7febde017bafa4141dfda93fe))
- Make game master controls smaller and size adjustable (#312) ([29f133a](../../commit/29f133aa6118219c19b07200a565e9df95219b35))
- Set question visibility per target (players and screen) (#314) ([d6bf96a](../../commit/d6bf96aafeb24e643ab09a41749904ccb97c6fcb))
- Enforce late join, rejoin, approval and team rules on join (#315) ([06e73b4](../../commit/06e73b4d88206b6f15b7203881644d0cb92f93f2))
- Implement the join flow (#316) ([2d089e4](../../commit/2d089e487ff6900b098cb0a9093fcf1d63537ff9))
- Order buzzes by host receive time (#318) ([0d857e8](../../commit/0d857e85130fc8f45c2318649a643d41ecd8892c))
- Send question content to admitted players per visibility (#320) ([d2861f5](../../commit/d2861f5d36a41056eafdea3ce12ca84ff363fde7))
- Connect the play screen and send buzz, leave and focus events (#321) ([47b6c5e](../../commit/47b6c5ed4fa3213d35a225c147af53c0d15a23be))
- Show question content on player phones (#322) ([940ea50](../../commit/940ea50f6748e5c3dece08c889e0f840bde52c2b))
- Add a host-side projector window (#323) ([d777b6d](../../commit/d777b6dcaa7cc55a328691c49acab9e78d431eb8))
- Add a networked screen peer (#325) ([952e268](../../commit/952e268098b27cfbae19bc85c73c9a799e517b25))
- Surface transport errors and reconnect (#365) ([d10e734](../../commit/d10e734181a7f6ac4d2409034fe4a50fded4f556))
- Explain non-obvious controls with help tooltips (#375) ([66027d5](../../commit/66027d5d1749dfbfbe3acd64e87695a9790f17a3))
- Show a live-game indicator next to Games in the sidebar (#376) ([ea08ad6](../../commit/ea08ad60fd27d353c8dcf1bee2c81308a1c8bbd5))
- Push short messages to players, teams and screens (#377) ([2d2c3a3](../../commit/2d2c3a3495ec9ccb40a9a4b1d1e771f816cfc771))
- Scoreboard table with direct score entry and a score log (#381) ([62b39b9](../../commit/62b39b910e505052d830985de8ed5b1d2e968652))
- Move debug info into the left sidebar (#382) ([f4c648e](../../commit/f4c648e9f363440fdf4301fc9080815180507ab5))
- Compact, grouped game settings with presets (#384) ([db21c14](../../commit/db21c140aac7abe7fa61aa21e66081ad884cda0a))
- Settings categories and a versioned settings store (#388) ([c2d91c0](../../commit/c2d91c09795a4278f5bed9de7a28b0ce0777bbf5))
- Command palette (Ctrl/⌘+K) (#389) ([21d34c4](../../commit/21d34c4d7011f5e191642067282b05da5c3666de))
- Sound and timer default settings (#390) ([b1c94da](../../commit/b1c94da6932819d003b98bec1b390d5d4d95c18d))
- Build rounds inline in the new-game wizard (#393) ([f1db0c6](../../commit/f1db0c6bd627bdc637344d072a38f2b069aa3783))
- Group the host view into play and a tabbed side panel (#394) ([6a542f2](../../commit/6a542f2de45b6191230e32f2a43b8a5213a3007f))
- Game defaults settings, including the tiebreaker mode (#395) ([3d08c4c](../../commit/3d08c4cd769235029ee2a945d69c63183846c200))
- Confirm-destructive-actions and join URL base settings (#396) ([977cab7](../../commit/977cab790cb5c48cc54c6eab37e87cd68afaf77a))
- Record a game log and show it in a Log tab (#397) ([e48123f](../../commit/e48123f481b3e8c9800076f49a74cd162b19d390))
- Load demo data from Settings → Data and the command palette (#399) ([6f90253](../../commit/6f902531bf8b3a1db022dd76374ffb7ec4a428ba))
- Command palette finds settings, players, teams and notes (#401) ([f9c9bbf](../../commit/f9c9bbfc0d56c9c0f198e9e0595b310f6804a314))
- Add, edit, reorder and delete game setting presets (#402) ([18455e8](../../commit/18455e818cef7d5c670453f0596f08a61baaf5c6))
- Auto-merge Dependabot PRs after CI passes (#405) ([e46d70e](../../commit/e46d70e5122365d96e19d5268435daecd6975f49))
- Search, filter and sort the game log panel (#406) ([f0c88b5](../../commit/f0c88b53618b8aa91ad868c499e4443850447f22))
- Add a log event for approved screens (#416) ([db274cd](../../commit/db274cd6277579a066b3b460e808b11624056d6e))
- Add the widget registry and extract the lobby QR panel (#417) ([ee283a0](../../commit/ee283a068b3ace2743ee9b689513e280f635d3e4))
- Extract round info, announcements and screen question/answers/media (#418) ([5b08960](../../commit/5b08960b34dcb24405891e24d551589f4277094e))
- List and disconnect approved screens (#425) ([b9c41ac](../../commit/b9c41ac806349877e38e9e54a6baff62f17925ef))
- Make the buzzer optional per game (#426) ([6e5a083](../../commit/6e5a08368c8e5f6a50478799e008ec84efc8bb45))
- Add player, bulk actions and team assignment from the roster (#427) ([26541a7](../../commit/26541a76a270f3e9b65c024ee87816713e713eb0))
- Rename teams, add team notes, and click-to-select members (#429) ([08eb6cb](../../commit/08eb6cb896ac40db484798a9451df037c961b447))
- Add player notes per game (#431) ([90c592a](../../commit/90c592ab8eb93325827d8419c0887227854af636))
- Cap total players per game (#432) ([78672be](../../commit/78672bedcdd6fc5d23f15de20d93e0a3312b752b))
- Group roster by team, log messages, rework log kind filter (#433) ([8b142fd](../../commit/8b142fdd53ae58ccbab8453560845260055979b9))
- Add rejoin window, confirm-navigation, auto-timer and sound mute (#434) ([bb27f10](../../commit/bb27f10b757f9318867500004bbcc8723e6b6e60))
- Warn the host when a join's device mismatches an existing player's name (#435) ([6cea910](../../commit/6cea910be8bef3a3091eb1bb94d7a60c55e26188))
- Layout model v2 with grid placement, phases and themes (#439) ([778c305](../../commit/778c305dadeac6ab8cb61dfcaba22c9759bef037))
- Render the projector screen through layouts (#440) ([6dabe38](../../commit/6dabe386517fdf51072d079d5a842d598986eebf))
- Render the game master and player views through layouts (#442) ([2553b69](../../commit/2553b69512ca0a43542f64abdd675cd7848b6254))
- Send stored layouts to remote players and screens (#444) ([2e7d6a7](../../commit/2e7d6a7d35441d3137cd8907fd8038e172cbf8a6))
- Add the layout designer with canvas, palette and inspector (#445) ([aeef87d](../../commit/aeef87d7fcd053454ff1f2346727ca32283c2f35))
- Add undo, keyboard editing and templates to the layout designer (#446) ([d56c20f](../../commit/d56c20fe8da9f32ea798933fb3612d36d0735b20))
- Switch layouts by game phase, with a GM override (#447) ([d9837e7](../../commit/d9837e74b7f2613ef796ececd519a1ca0e41c4f3))
- Choose a game's layouts per surface and phase (#448) ([1f48e5a](../../commit/1f48e5a820f2a9719d4e0cbf0fa62286224e8639))
- Add a standalone progress widget (#449) ([69069fb](../../commit/69069fb24cc1c0f1643605f2caba0ded1914793f))
- Add the buzz order, player list and game controls widgets (#452) ([647a055](../../commit/647a055ed18470fc5226eeb194b4436d7021a602))
- Add the text and image widgets (#454) ([56b8ad9](../../commit/56b8ad91b307b89743d8812fc0855e24c8e2178b))
- Add the leaderboard widget for the projector screen (#455) ([2febac6](../../commit/2febac685af997be34361330d21d2e10c64e0ec9))
- Self-host fonts so they work offline (#465) ([b930fbb](../../commit/b930fbbe8390b6d8932b996f43b25ca6a1f4072f))
- Add the theme model, built-in themes and theme backups (#466) ([9037831](../../commit/9037831984e8f795f16426d76fd04cd7838f5f55))
- Theme picker and editor in appearance settings (#467) ([fc85c79](../../commit/fc85c793c7d2bf99fdc5c1cce88c004991fa7e88))
- Let each game choose its own theme (#468) ([97058af](../../commit/97058af6e67562669488335a060dcfc0ab73eb11))
- Send the game theme to players and screens (#469) ([5c30972](../../commit/5c309722af3a3da07aabfa0b04eff90121836844))
- Show theme logos and colour the browser bar (#470) ([00a1938](../../commit/00a19388d3fc97dcdb57896090fe5d701a93f1a2))
- Add question, round and game timer shortcuts (#473) ([a242425](../../commit/a24242553072675cdbeb76375ec9300188c98c5e))
- Move to the next question after a correct answer or timeout (#474) ([94284d6](../../commit/94284d6b7b5251975acf938469f22957ea115e4a))
- Remove players who stay disconnected past a timeout (#475) ([085a530](../../commit/085a53071654a6143deea53c17d558f1aa9ee140))
- Rule on a question without a buzz (#476) ([858b8ce](../../commit/858b8ce6e9114c1ae5a06973f29746148596dd6a))
- Reveal the correct answer to players and the screen (#477) ([a9287a7](../../commit/a9287a7d652dde7d37452ae462e8f9a26e3cacd1))
- Review a round's answers at its end (#478) ([bf6e1fa](../../commit/bf6e1fa14d24b7cb32d25ec42d8eecbcb41e5bf7))
- Let players pick an option on their phones (#479) ([b99a5a7](../../commit/b99a5a74051ee09530fd97f32983f7a5e9406cf1))
- Let players type their answers (#480) ([fc8308f](../../commit/fc8308f0364369c0c34b25e2727b28195eee2bc3))
- Mark a round's answers on one sheet (#482) ([fdc0324](../../commit/fdc0324f26c8fe33bbccc7b087f79d739694f488))
- Hold scores until the host announces them (#483) ([348b650](../../commit/348b6502f3e2c23f76bd273c1f80c64ac3a8f65e))
- Keep answers open until the end of the round (#484) ([026d36a](../../commit/026d36a935dfbbb9fd62441a49c0cadca063dfb9))
- Let teams answer by first reply or captain (#485) ([8ee1801](../../commit/8ee18012d040f9febeb00d35bc94d8e29a7a7b8c))
- Let teams vote on their answer (#486) ([d89c522](../../commit/d89c5223c6e637a47633562a265169e4bd490164))
- Break tied scores by most correct answers (#487) ([0acb775](../../commit/0acb7754025ccf1d9f09d961d13fd8a63c374de4))
- Let people watch a game without playing (#490) ([2378f85](../../commit/2378f85b907d6dc50d55a2e11258c70be3261d90))

### Refactoring

- Remove the Gun.js transport (#307) ([e4f2c54](../../commit/e4f2c546bbba419d8da8265b1e838e80b6acb71f))
- Use canStartGame in the lobby and drop the unused modalOpen state (#368) ([2e50fa4](../../commit/2e50fa4c028364e966aa977568b2088bcd024e26))
- Move PlayerTimers to a shared component (#370) ([b608021](../../commit/b60802139c7155cb3f24f0efa80e834431adb15c))
- Move the Lobby and ActiveGame views out of GameMaster (#371) ([481d598](../../commit/481d5985464a1f1ac748602e98223d3a7eabfb47))
- Migrate components to semantic colour tokens (#464) ([ad51def](../../commit/ad51def41cdb6b7a8813dec85e83a872727b9d25))

### test

- Smoke — loads and passes offline audit ([fb9a34d](../../commit/fb9a34d3c249bfd203ba748a4fc9ada19de59fb2))
- Install and wire up playwright ([936983e](../../commit/936983e6b6f8ea0faf049b871aa5a8712594b40a))
- Manage players and teams end-to-end ([14f2bb9](../../commit/14f2bb92a60126ce9faf36e8a0fb9fedf66963e4))
- Manage questions and rounds end-to-end ([3baa835](../../commit/3baa83560ab65e29004994d399bf20a4c87c9752))
- Run a full game session ([adf220e](../../commit/adf220ea24ec44416af09638974a1301c684e394))
- Buzzer events across two browser contexts ([577afde](../../commit/577afdef89296f92c59adb765fd8a23e9428431e))
- Screen widget layout renders correctly ([1c9cc2e](../../commit/1c9cc2e8317fb281a9bd907b14e06fa81a5c03c2))
- Data survives page reload ([1b1168c](../../commit/1b1168c41ab58a9fa4c64fcf5bbbdedc6fa45cc5))
- Keyboard navigation and aria compliance ([cda5240](../../commit/cda52406db4146375ed27301ce140b59243e0eb3))
- Add zod contract schemas for transport messages (#237) ([f97be4f](../../commit/f97be4f40f6ce54af214910b43cabb94cc4b0bb3))
- Add property-based tests for scoring and navigation (#239) ([43905cf](../../commit/43905cf7e39c50481b3028a58724bb4416c0d063))
- Use per-target visibility in the join test fixture (#319) ([5e7a87c](../../commit/5e7a87ce9b9595a429e0e4e1707ab495370f53b3))
- Replace the Playwright specs with an in-process game flow test (#326) ([8a787d5](../../commit/8a787d563d3fa9193918d068e47f415c5a1291b8))
- Cover the host panels and restore the coverage thresholds (#331) ([ddcded1](../../commit/ddcded16b5e6fecf1bfb6d5c84a99c77f4e8f3c1))
- Wait for the add form to close in the difficulty order test (#391) ([93bcb90](../../commit/93bcb90c054a4e0e60012a50845c8dde7f2c3fcd))

## v0.0.11 - 2026-04-19

### Bug Fixes

- Render lists, h5/h6, definitions, and sanitized html in markdown ([e19743c](../../commit/e19743c290ad860d0359492c93d8034abef8a002))
- Render team icons as lucide components in player list and form ([6e97929](../../commit/6e9792926bc5518f3f11803e6961c18e020b230a))
- Wire ManageLabels into Settings page ([41093b1](../../commit/41093b18cdf3c24d55b55362aff1734fd9ec14a0))
- Add multi-select checkboxes to team list ([23ead0b](../../commit/23ead0b7be601b358526057ff5b94251ebec771b))
- Correct dashboard test queries and round fixture shape ([ac90e8a](../../commit/ac90e8ac06c475a6554b5811ecb0a95c6822f033))

### Chores

- Fix Create GitHub Release step ([2635fed](../../commit/2635fed8c62075de1724ac0a5822f26f43ea529a))
- Update release workflow name dynamically ([e3c6da1](../../commit/e3c6da19a30aa7dad0a9c5e3adf4923c4573f925))
- Remove release-it ([82e4063](../../commit/82e406380ea5dad201fc0a3600c91d4cccfbd788))
- Update package-lock.json ([bf1119a](../../commit/bf1119a76cdf7bef33062bbf47d0c431e74b1742))
- Remove pack script clutter ([49d85e5](../../commit/49d85e5f82a4c317055a3b77a5a73bfdb88affeb))

### Features

- In-game progress indicator with round pills and question circles ([60c1049](../../commit/60c104912da642fc8ec7edb15c6da6344761fc05))
- Add unit and integration test coverage for gamemaster logic ([d1549db](../../commit/d1549dbbb5677d2c95137324badf395a21f1e9fd))
- Tri-state action button display mode setting ([585b2aa](../../commit/585b2aa2f13a5a09e6c1a818c22ec6aa88dc448e))

### Refactoring

- Changelog output ([6ba981c](../../commit/6ba981c6132efdc343fae5cb18fdfc860fb6e297))
- Sadly can't be updated dynamically ([cd9cf3b](../../commit/cd9cf3b05fc1c775973c3edbcd61eb920c2dc6d8))
- Replace full-screen timer overlay with toast system ([c823ac4](../../commit/c823ac4c46e589dc79d963d8a878ae9b1e50ad56))
- Redesign dashboard with 3 tiles and structural footers ([f896e9c](../../commit/f896e9ca438606f0a14220630e8c323d9f0b4d9e))

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
