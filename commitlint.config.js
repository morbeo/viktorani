export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'chore', 'docs', 'refactor',
      'perf', 'test', 'ci', 'build', 'revert',
      'epic',                                              // ← added
    ]],
    'scope-enum': [2, 'always', [                         // ← error, not warning
      // Features
      'admin', 'player', 'gamemaster',
      // Data & transport
      'db', 'transport',
      // UI
      'ui', 'routing',
      // PWA & build
      'pwa', 'build',
      // Tooling
      'deps', 'release', 'test', 'lint', 'github',        // ← ci removed
    ]],
    'scope-case': [2, 'always', 'lower-case'],            // ← new
    'subject-case': [2, 'never', [
      'start-case', 'pascal-case', 'upper-case', 'sentence-case',
    ]],
    'header-max-length': [2, 'always', 100],
  },
}
