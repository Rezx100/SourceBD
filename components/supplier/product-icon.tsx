import { productIconUrl } from "@/lib/product-icons";
import { cn } from "@/lib/utils";

export function ProductIcon({
  product,
  className,
}: {
  product: string;
  className?: string;
}) {
  return (
    <img
      src={productIconUrl(product)}
      alt=""
      aria-hidden
      className={cn("product-icon-img", className)}
    />
  );
}
