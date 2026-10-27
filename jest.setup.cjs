jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock'),
);

beforeEach(async () => {
  await require('@react-native-async-storage/async-storage').clear();
  // Queue tests exercise local enqueueing without starting simulated sync timers.
  require('@react-native-community/netinfo').fetch.mockResolvedValue({ isConnected: false });
});
