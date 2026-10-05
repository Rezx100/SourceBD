import { PaneSkeleton } from "@/components/kit";

export default function AdminUserDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[760px]">
      <PaneSkeleton />
    </div>
  );
}
