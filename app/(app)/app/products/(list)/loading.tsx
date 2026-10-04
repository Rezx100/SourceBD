import { ProductsSkeleton } from "@/components/products/list";

// The layout draws the frame; this is the content region while the list loads. It sits in the `(list)`
// group so the edit page's 404 is not wrapped by it.

export default function ProductsLoading() {
  return <ProductsSkeleton />;
}
