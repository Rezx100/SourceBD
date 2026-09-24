// The saved-search route's refusal strings, in one place: the route sends
// them and the form maps them to sentences, so they cannot drift apart.
export const SAVED_SEARCH_ERROR = {
  invalidName: "invalid name",
  tooLong: "search too long to save",
  limitReached: "saved search limit reached",
} as const;
