import { createClient } from "@supabase/supabase-js";
import type { AccreditationStorageClient } from "@/modules/reporting/accreditation";

export function createAccreditationStorageClient(): AccreditationStorageClient {
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
    async upload(
      bucket: string,
      path: string,
      buffer: Buffer,
      contentType: string,
    ): Promise<void> {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        throw new Error(`Failed to upload file: ${error.message}`);
      }
    },

    async exists(bucket: string, path: string): Promise<boolean> {
      const { data, error } = await supabase.storage.from(bucket).list(
        path.split("/").slice(0, -1).join("/"),
        {
          search: path.split("/").pop(),
        },
      );

      if (error) {
        return false;
      }

      return data.length > 0;
    },

    async signedUrl(
      bucket: string,
      path: string,
      expiresInSeconds: number,
    ): Promise<string> {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);

      if (error || !data?.signedUrl) {
        throw new Error(
          `Failed to generate signed URL: ${error?.message ?? "unknown error"}`,
        );
      }

      return data.signedUrl;
    },
  };
}
