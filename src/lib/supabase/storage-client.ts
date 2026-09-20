import { createClient } from "@supabase/supabase-js";
import { DocumentStorageClient } from "@/modules/admissions/document-checklist";

export function createStorageClient(): DocumentStorageClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase storage client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return {
    async generateSignedUploadUrl(
      path: string,
      _expiresInSeconds: number,
    ): Promise<string> {
      const { data, error } = await supabase.storage
        .from("academy-documents")
        .createSignedUploadUrl(path, { upsert: true });

      if (error || !data?.signedUrl) {
        throw new Error(`Failed to generate signed upload URL: ${error?.message ?? "unknown error"}`);
      }

      return data.signedUrl;
    },

    async delete(path: string): Promise<void> {
      const { error } = await supabase.storage
        .from("academy-documents")
        .remove([path]);

      if (error) {
        throw new Error(`Failed to delete file: ${error.message}`);
      }
    },

    async generateSignedDownloadUrl(
      path: string,
      expiresInSeconds: number,
    ): Promise<string> {
      const { data, error } = await supabase.storage
        .from("academy-documents")
        .createSignedUrl(path, expiresInSeconds);

      if (error || !data?.signedUrl) {
        throw new Error(`Failed to generate signed download URL: ${error?.message ?? "unknown error"}`);
      }

      return data.signedUrl;
    },

    async getObjectMetadata(path: string) {
      const lastSlash = path.lastIndexOf("/");
      const folder = lastSlash === -1 ? "" : path.slice(0, lastSlash);
      const filename = lastSlash === -1 ? path : path.slice(lastSlash + 1);

      const { data, error } = await supabase.storage
        .from("academy-documents")
        .list(folder, { search: filename });

      if (error || !data) {
        return undefined;
      }

      const entry = data.find((file) => file.name === filename);
      if (!entry?.metadata) {
        return undefined;
      }

      return {
        size: Number(entry.metadata.size ?? 0),
        contentType: String(entry.metadata.mimetype ?? ""),
      };
    },
  };
}
