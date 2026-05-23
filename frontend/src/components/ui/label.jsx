"use client"

import * as Silian_React from "react"
import * as Silian_LabelPrimitive from "@radix-ui/react-label"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Label({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_LabelPrimitive.Root
      data-slot="label"
      className={Silian_cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        Silian_className
      )}
      {...Silian_props} />
  );
}

export { Silian_Label as Label }
