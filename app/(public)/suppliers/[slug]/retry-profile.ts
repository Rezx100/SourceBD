import { revalidatePath, revalidateTag } from "next/cache";

import { tagSupplier } from "@/lib/cache/tags";
import {
  clearPublicProfileTimeoutShed,
  isPublicSupplierSlug,
} from "@/lib/public-supplier-profile";

export async function retryPublicProfile(
  slug: string,
): Promise<"invalid" | "ok"> {
  if (!isPublicSupplierSlug(slug)) return "invalid";
  revalidateTag(tagSupplier(slug));
  revalidatePath(`/suppliers/${slug}`);
  clearPublicProfileTimeoutShed(slug);
  return "ok";
}
