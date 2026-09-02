export default {
  mutate: ['cloudfunctions/auth/perm-matrix-shared.js'],
  testRunner: 'command',
  command: 'node tests/perm-logic-test.js',
  mutator: { excludedMutations: [] },
  reporters: ['clear-text'],
  concurrency: 4,
  timeoutMS: 60000,
  tempDirName: '.tmp-mut-r11',
  dryRunUrls: false
};
