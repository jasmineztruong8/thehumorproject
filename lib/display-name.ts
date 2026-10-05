export type Author = { first_name: string | null; last_name: string | null } | null;

// Members see "First L."; signed-out visitors can't read profiles at all
// (RLS), so they see anon1, anon2, ... numbered by first appearance on the
// page. Numbers are per page, so a label can't be used to follow someone
// across the site.
export function createAuthorLabeler(signedIn: boolean) {
  const anonNumbers = new Map<string, number>();

  return function label(userId: string | null, author: Author) {
    if (!userId) return null;
    if (signedIn && author?.first_name) {
      return `${author.first_name} ${author.last_name?.[0] ?? ""}.`.replace(" .", "");
    }
    if (!anonNumbers.has(userId)) anonNumbers.set(userId, anonNumbers.size + 1);
    return `anon${anonNumbers.get(userId)}`;
  };
}
