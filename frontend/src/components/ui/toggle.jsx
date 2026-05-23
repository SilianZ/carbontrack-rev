import * as Silian_React from "react"
import * as Silian_TogglePrimitive from "@radix-ui/react-toggle"

import { cn as Silian_cn } from "@/lib/utils"
import { toggleVariants as Silian_toggleVariants } from "@/components/ui/toggle-styles"

function Silian_Toggle({
  className: Silian_className,
  variant: Silian_variant,
  size: Silian_size,
  ...Silian_props
}) {
  return (
    <Silian_TogglePrimitive.Root
      data-slot="toggle"
      className={Silian_cn(Silian_toggleVariants({ variant: Silian_variant, size: Silian_size, className: Silian_className }))}
      {...Silian_props} />
  );
}

export { Silian_Toggle as Toggle }
