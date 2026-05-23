"use client";
import * as Silian_React from "react"
import * as Silian_ToggleGroupPrimitive from "@radix-ui/react-toggle-group"

import { cn as Silian_cn } from "@/lib/utils"
import { toggleVariants as Silian_toggleVariants } from "@/components/ui/toggle-styles"

const Silian_ToggleGroupContext = Silian_React.createContext({
  size: "default",
  variant: "default",
})

function Silian_ToggleGroup({
  className: Silian_className,
  variant: Silian_variant,
  size: Silian_size,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={Silian_variant}
      data-size={Silian_size}
      className={Silian_cn(
        "group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs",
        Silian_className
      )}
      {...Silian_props}>
      <Silian_ToggleGroupContext.Provider value={{ variant: Silian_variant, size: Silian_size }}>
        {Silian_children}
      </Silian_ToggleGroupContext.Provider>
    </Silian_ToggleGroupPrimitive.Root>
  );
}

function Silian_ToggleGroupItem({
  className: Silian_className,
  children: Silian_children,
  variant: Silian_variant,
  size: Silian_size,
  ...Silian_props
}) {
  const Silian_context = Silian_React.useContext(Silian_ToggleGroupContext)

  return (
    <Silian_ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={Silian_context.variant || Silian_variant}
      data-size={Silian_context.size || Silian_size}
      className={Silian_cn(Silian_toggleVariants({
        variant: Silian_context.variant || Silian_variant,
        size: Silian_context.size || Silian_size,
      }), "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l", Silian_className)}
      {...Silian_props}>
      {Silian_children}
    </Silian_ToggleGroupPrimitive.Item>
  );
}

export { Silian_ToggleGroup as ToggleGroup, Silian_ToggleGroupItem as ToggleGroupItem }
