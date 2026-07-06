import { AlsoProducesChips } from "@/components/supplier/also-produces-chips";
import { ProductIcon } from "@/components/supplier/product-icon";
import { ProfileCard, ProfileCardHeader } from "@/components/supplier/profile-ui";
import { correctProductSpelling, dedupProducts } from "@/lib/product-icons";

// Principal products get their own Overview-tab card with real hierarchy —
// a few signature categories featured large, the rest grouped and quieter —
// instead of every category rendered at equal weight. Buyers see every
// declared product with its icon; nothing is hidden behind a "+N more"
// toggle.

const SIGNATURE_LIMIT = 4;

export function PrincipalProductsCard({ products }: { products: string[] }) {
  const unique = dedupProducts(products);
  if (unique.length === 0) return null;

  const signature = unique.slice(0, SIGNATURE_LIMIT);
  const rest = unique.slice(SIGNATURE_LIMIT);

  return (
    <ProfileCard id="products">
      <ProfileCardHeader
        title="Principal products"
        meta={`${unique.length} ${unique.length === 1 ? "category" : "categories"}`}
      />
      <p className="text-[12.5px] font-semibold text-neutral-500">
        Signature categories
      </p>
      {/* Flat icon + label pairs — hierarchy comes from type scale, not
          boxed chips, so the card stays a single visual surface. Phones:
          a fixed 2-column grid instead of flex-wrap, since 4 variable-width
          labels wrapping freely produced a ragged 2-1-1 stagger; sm+ keeps
          the original free-flowing run. */}
      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
        {signature.map((product) => (
          <span key={product} className="inline-flex min-w-0 items-start gap-2 sm:items-center sm:gap-2.5">
            <ProductIcon product={product} className="product-icon mt-px sm:mt-0" />
            <span className="min-w-0 text-[14px] font-semibold leading-[1.3] text-neutral-900 sm:text-[15px] sm:leading-normal">
              {correctProductSpelling(product)}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-2.5 text-[13px] text-neutral-500">
        Most frequently listed across this supplier&apos;s source records.
      </p>

      {rest.length > 0 ? (
        <>
          <div
            aria-hidden
            className="mt-5 h-px bg-gradient-to-r from-neutral-200/0 via-neutral-200/70 to-neutral-200/0"
          />
          <p className="mt-4 text-[12.5px] font-semibold text-neutral-500">
            Also produces <span className="text-neutral-400">· {rest.length}</span>
          </p>
          <div className="mt-2.5">
            <AlsoProducesChips products={rest} />
          </div>
        </>
      ) : null}
    </ProfileCard>
  );
}
