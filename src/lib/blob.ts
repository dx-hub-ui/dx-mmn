import { put } from "@vercel/blob";

export async function uploadAvatarBlob(
  file: Blob,
  {
    userId,
    contentType,
    fileName,
  }: {
    userId: string;
    contentType: string;
    fileName?: string;
  }
) {
  const safeFileName = (fileName ?? "avatar").toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
  const key = `avatars/${userId}/${Date.now()}-${safeFileName}`.replace(/-+/g, "-");

  const result = await put(key, file, {
    access: "public",
    contentType,
  });

  return result.url;
}
