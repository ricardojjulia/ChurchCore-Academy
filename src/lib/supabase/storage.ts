import { createClient as createSupabaseClient } from "@supabase/supabase-js";

interface SupabaseStorageConfig {
  url: string;
  serviceRoleKey: string;
  bucket: string;
}

export class SupabaseStorageProvider {
  private client;
  private bucket: string;

  constructor(config: SupabaseStorageConfig) {
    this.client = createSupabaseClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    this.bucket = config.bucket;
  }

  async generateUploadUrl(
    path: string,
    _mimeType: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(path, {
        upsert: false,
      });

    if (error || !data) {
      throw new Error(`Failed to generate upload URL: ${error?.message ?? "Unknown error"}`);
    }

    // Note: createSignedUploadUrl returns a token, not a full URL
    // The URL format is: {SUPABASE_URL}/storage/v1/object/upload/sign/{bucket}/{path}?token={token}
    return data.signedUrl;
  }

  async generateDownloadUrl(
    path: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Failed to generate download URL: ${error?.message ?? "Unknown error"}`);
    }

    return data.signedUrl;
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
}

export function createStorageProvider(): SupabaseStorageProvider {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase storage requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return new SupabaseStorageProvider({
    url,
    serviceRoleKey,
    bucket: "academy-application-documents",
  });
}
