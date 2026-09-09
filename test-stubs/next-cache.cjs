module.exports = {
  revalidatePath() {},
  revalidateTag() {},
  unstable_noStore() {},
  unstable_cache(fn) {
    return fn;
  },
};
