export const metadata = { title: "Privacy · The Humor Project" };

export default function PrivacyPage() {
  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16 flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p>
        The Humor Project is a class project. When you sign in with Google we
        receive your name, email address and Google account ID, and store them
        with your profile so you can upload photos and caption them. Signed-out
        visitors never see your name; they see a label like &ldquo;anon1&rdquo;.
      </p>
      <p>
        Photos you upload (and your profile photo) are stored in Supabase
        Storage and are publicly viewable by URL. To write captions, uploaded
        photos are sent to Google Gemini, which describes them; the
        description, the prompts and the captions are saved with the photo.
        Deleting your account deletes all of it. We don&apos;t sell or share
        your data.
      </p>
    </main>
  );
}
