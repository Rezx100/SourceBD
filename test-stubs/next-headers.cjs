module.exports = {
  // No request in a test: the server client forwards no address (lib/ledger/request-headers).
  headers: async () => new Headers(),
  cookies: async () => ({
    get() {
      return undefined;
    },
    getAll() {
      return [];
    },
    set() {},
  }),
};
