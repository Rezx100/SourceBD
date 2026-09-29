module.exports = {
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
