import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminDeleteUser } from "@/app/actions";
import { getCurrentUser, isSuperadmin } from "@/lib/auth";
import { DeleteButton } from "@/components/delete-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · The Humor Project" };

type Row = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  is_superadmin: boolean;
  created_at: string;
  images: { count: number }[];
  captions: { count: number }[];
};

// Superadmins only. Deleting here is still checked by RLS in the database:
// the page hides itself, the policy is what actually protects profiles.
export default async function AdminPage() {
  const { user, profile } = await getCurrentUser();
  if (!user || !isSuperadmin(profile)) notFound();

  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, is_superadmin, created_at, images(count), captions(count)")
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Users</h1>
      {error && <p className="text-red-500">Failed to load users: {error.message}</p>}
      <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
        {users?.map((u) => (
          <li key={u.id} className="py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium truncate">
                {u.first_name || u.last_name ? `${u.first_name ?? ""} ${u.last_name ?? ""}` : "(no name yet)"}
                {u.is_superadmin && <span className="ml-2 text-xs text-neutral-500">superadmin</span>}
              </p>
              <p className="text-sm text-neutral-500">
                {u.images[0]?.count ?? 0} photos · {u.captions[0]?.count ?? 0} captions · joined{" "}
                {new Date(u.created_at).toLocaleDateString()}
              </p>
            </div>
            {u.id !== user.id && (
              <DeleteButton
                action={adminDeleteUser.bind(null, u.id)}
                confirmText="Permanently delete this user and everything they made?"
                label="Delete user"
              />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
