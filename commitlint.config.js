export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'chore', 'docs', 'refactor',
      'perf', 'test', 'ci', 'build', 'revert',
      'epic',
    ]],
    'scope-enum': [1, 'always', [
      // Features
      'admin', 'player', 'gamemaster',
      // Data & transport
      'db', 'transport',
      // UI
      'ui', 'routing',
      // PWA & build
      'pwa', 'build',
      // Tooling
      'deps', 'docs', 'release', 'test', 'lint', 'github',
    ]],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-case': [2, 'never', [
      'start-case', 'pascal-case', 'upper-case', 'sentence-case',
    ]],
    'header-max-length': [2, 'always', 100],
  },
}
