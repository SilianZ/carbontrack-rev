"use client"

import * as Silian_React from "react"
import * as Silian_SeparatorPrimitive from "@radix-ui/react-separator"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Separator({
  className: Silian_className,
  orientation: Silian_orientation = "horizontal",
  decorative: Silian_decorative = true,
  ...Silian_props
}) {
  return (
    <Silian_SeparatorPrimitive.Root
      data-slot="separator-root"
      decorative={Silian_decorative}
      orientation={Silian_orientation}
      className={Silian_cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        Silian_className
      )}
      {...Silian_props} />
  );
}

export { Silian_Separator as Separator }
