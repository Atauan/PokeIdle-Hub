'use strict';

(function exposeAccountPartition(root, createApi) {
  const api = createApi();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.PokeIdleAccountPartition = api;
  }
})(globalThis, function createAccountPartitionApi() {
  const ADDITIONAL_PARTITION = /^persist:pokeidlehub-acc-[a-z0-9-]{1,60}$/i;

  function forAccount(account, primaryPartition = 'persist:pokeidlehub') {
    return account.main ? primaryPartition : `persist:pokeidlehub-acc-${account.id}`;
  }

  function isAdditionalPartition(partition) {
    return typeof partition === 'string' && ADDITIONAL_PARTITION.test(partition);
  }

  return Object.freeze({ forAccount, isAdditionalPartition });
});
