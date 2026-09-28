export const metadata = { title: "Privacy · The Humor Project" };

export default function PrivacyPage() {
  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16 flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p>
        The Humor Project is a class project. When you sign in with Google we
        receive your name, email address and Google account ID, and store them
        with your profile so you can submit jokes.
      </p>
      <p>
        If you upload a profile photo, it is stored in Supabase Storage and is
        publicly viewable by URL. We don&apos;t sell or share your data.
      </p>
    </main>
  );
}
