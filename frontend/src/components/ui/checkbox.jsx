"use client"

import * as Silian_React from "react"
import * as Silian_CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon as Silian_CheckIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Checkbox({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_CheckboxPrimitive.Root
      data-slot="checkbox"
      className={Silian_cn(
        "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        Silian_className
      )}
      {...Silian_props}>
      <Silian_CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none">
        <Silian_CheckIcon className="size-3.5" />
      </Silian_CheckboxPrimitive.Indicator>
    </Silian_CheckboxPrimitive.Root>
  );
}

export { Silian_Checkbox as Checkbox }
