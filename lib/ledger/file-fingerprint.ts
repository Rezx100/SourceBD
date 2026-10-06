// After a message with files is sent, the server reads each file back from the bucket under the sender's own
// session and writes its sha256 once (migration 0133). The browser uploads straight to the bucket, so this is
// the only place the stored bytes are ever read by us; the value is the server's reading, not a claim. Best
// effort: a file that cannot be read back, or a database that does not have 0133 yet, is logged and skipped,
// and the message stays sent.

import { createHash } from "node:crypto";

export const MESSAGE_FILES_BUCKET = "message-files";

type Downloaded = { data: Blob | null; error: unknown };
export type FingerprintClient = {
  storage: { from(bucket: string): { download(path: string): Promise<Downloaded> } };
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message?: string } | null }>;
};

/** The sha256 of a file's bytes, as hex. */
export function sha256Hex(bytes: ArrayBuffer | Uint8Array): string {
  return createHash("sha256").update(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).digest("hex");
}

/** Fingerprints every path of a just-sent message; answers how many were written. Never throws. */
export async function fingerprintMessageFiles(supabase: FingerprintClient, messageId: string, paths: readonly string[]): Promise<number> {
  let written = 0;
  for (const path of paths) {
    try {
      const { data, error } = await supabase.storage.from(MESSAGE_FILES_BUCKET).download(path);
      if (error || !data) {
        console.warn(`[messages] could not read back ${path} for its fingerprint`);
        continue;
      }
      const sha = sha256Hex(await data.arrayBuffer());
      const res = await supabase.rpc("message_attachment_fingerprint", { p_message_id: messageId, p_object_path: path, p_sha256: sha });
      if (res.error) {
        console.warn(`[messages] fingerprint of ${path} refused: ${res.error.message ?? "unknown"}`);
        continue;
      }
      written += 1;
    } catch (err) {
      console.warn(`[messages] fingerprint of ${path} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return written;
}
