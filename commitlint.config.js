export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'chore', 'docs', 'refactor',
      'perf', 'test', 'ci', 'build', 'revert',
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
      'deps', 'release', 'ci', 'test', 'lint', 'github',
    ]],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
  },
}
