"use client"

import * as Silian_React from "react"
import * as Silian_ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_ScrollArea({
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_ScrollAreaPrimitive.Root data-slot="scroll-area" className={Silian_cn("relative", Silian_className)} {...Silian_props}>
      <Silian_ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1">
        {Silian_children}
      </Silian_ScrollAreaPrimitive.Viewport>
      <Silian_ScrollBar />
      <Silian_ScrollAreaPrimitive.Corner />
    </Silian_ScrollAreaPrimitive.Root>
  );
}

function Silian_ScrollBar({
  className: Silian_className,
  orientation: Silian_orientation = "vertical",
  ...Silian_props
}) {
  return (
    <Silian_ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={Silian_orientation}
      className={Silian_cn(
        "flex touch-none p-px transition-colors select-none",
        Silian_orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        Silian_orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        Silian_className
      )}
      {...Silian_props}>
      <Silian_ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="bg-border relative flex-1 rounded-full" />
    </Silian_ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

export { Silian_ScrollArea as ScrollArea, Silian_ScrollBar as ScrollBar }
