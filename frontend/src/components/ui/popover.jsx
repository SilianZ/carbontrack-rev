"use client"

import * as Silian_React from "react"
import * as Silian_PopoverPrimitive from "@radix-ui/react-popover"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Popover({
  ...Silian_props
}) {
  return <Silian_PopoverPrimitive.Root data-slot="popover" {...Silian_props} />;
}

function Silian_PopoverTrigger({
  ...Silian_props
}) {
  return <Silian_PopoverPrimitive.Trigger data-slot="popover-trigger" {...Silian_props} />;
}

function Silian_PopoverContent({
  className: Silian_className,
  align: Silian_align = "center",
  sideOffset: Silian_sideOffset = 4,
  ...Silian_props
}) {
  return (
    <Silian_PopoverPrimitive.Portal>
      <Silian_PopoverPrimitive.Content
        data-slot="popover-content"
        align={Silian_align}
        sideOffset={Silian_sideOffset}
        className={Silian_cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
          Silian_className
        )}
        {...Silian_props} />
    </Silian_PopoverPrimitive.Portal>
  );
}

function Silian_PopoverAnchor({
  ...Silian_props
}) {
  return <Silian_PopoverPrimitive.Anchor data-slot="popover-anchor" {...Silian_props} />;
}

export { Silian_Popover as Popover, Silian_PopoverTrigger as PopoverTrigger, Silian_PopoverContent as PopoverContent, Silian_PopoverAnchor as PopoverAnchor }
