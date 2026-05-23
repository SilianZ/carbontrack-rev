"use client"

import * as Silian_React from "react"
import * as Silian_RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { CircleIcon as Silian_CircleIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_RadioGroup({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={Silian_cn("grid gap-3", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_RadioGroupItem({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={Silian_cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        Silian_className
      )}
      {...Silian_props}>
      <Silian_RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center">
        <Silian_CircleIcon
          className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </Silian_RadioGroupPrimitive.Indicator>
    </Silian_RadioGroupPrimitive.Item>
  );
}

export { Silian_RadioGroup as RadioGroup, Silian_RadioGroupItem as RadioGroupItem }
