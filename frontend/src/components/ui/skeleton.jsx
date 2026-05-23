import { cn as Silian_cn } from "@/lib/utils"

function Silian_Skeleton({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="skeleton"
      className={Silian_cn("bg-accent animate-pulse rounded-md", Silian_className)}
      {...Silian_props} />
  );
}

export { Silian_Skeleton as Skeleton }
