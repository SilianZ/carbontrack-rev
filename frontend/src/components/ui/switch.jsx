"use client"

import * as Silian_React from "react"
import * as Silian_SwitchPrimitive from "@radix-ui/react-switch"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Switch({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_SwitchPrimitive.Root
      data-slot="switch"
      className={Silian_cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        Silian_className
      )}
      {...Silian_props}>
      <Silian_SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={Silian_cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )} />
    </Silian_SwitchPrimitive.Root>
  );
}

export { Silian_Switch as Switch }
