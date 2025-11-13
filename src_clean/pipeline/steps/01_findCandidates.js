// Finds new latin names not present in current ready store
export async function findCandidates({ whitelist = [], limit = 10 }) {
  const list = whitelist
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, limit);
  return list;
}
