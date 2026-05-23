import * as Silian_React from "react"
import * as Silian_ProgressPrimitive from "@radix-ui/react-progress"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Progress({
  className: Silian_className,
  value: Silian_value,
  ...Silian_props
}) {
  return (
    <Silian_ProgressPrimitive.Root
      data-slot="progress"
      className={Silian_cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        Silian_className
      )}
      {...Silian_props}>
      <Silian_ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="bg-primary h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${100 - (Silian_value || 0)}%)` }} />
    </Silian_ProgressPrimitive.Root>
  );
}

export { Silian_Progress as Progress }
