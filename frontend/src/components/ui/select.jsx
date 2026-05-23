import * as Silian_React from "react"
import * as Silian_SelectPrimitive from "@radix-ui/react-select"
import { CheckIcon as Silian_CheckIcon, ChevronDownIcon as Silian_ChevronDownIcon, ChevronUpIcon as Silian_ChevronUpIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Select({
  ...Silian_props
}) {
  return <Silian_SelectPrimitive.Root data-slot="select" {...Silian_props} />;
}

function Silian_SelectGroup({
  ...Silian_props
}) {
  return <Silian_SelectPrimitive.Group data-slot="select-group" {...Silian_props} />;
}

function Silian_SelectValue({
  ...Silian_props
}) {
  return <Silian_SelectPrimitive.Value data-slot="select-value" {...Silian_props} />;
}

function Silian_SelectTrigger({
  className: Silian_className,
  size: Silian_size = "default",
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={Silian_size}
      className={Silian_cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props}>
      {Silian_children}
      <Silian_SelectPrimitive.Icon asChild>
        <Silian_ChevronDownIcon className="size-4 opacity-50" />
      </Silian_SelectPrimitive.Icon>
    </Silian_SelectPrimitive.Trigger>
  );
}

function Silian_SelectContent({
  className: Silian_className,
  children: Silian_children,
  position: Silian_position = "popper",
  ...Silian_props
}) {
  return (
    <Silian_SelectPrimitive.Portal>
      <Silian_SelectPrimitive.Content
        data-slot="select-content"
        className={Silian_cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md",
          Silian_position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          Silian_className
        )}
        position={Silian_position}
        {...Silian_props}>
        <Silian_SelectScrollUpButton />
        <Silian_SelectPrimitive.Viewport
          className={Silian_cn("p-1", Silian_position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1")}>
          {Silian_children}
        </Silian_SelectPrimitive.Viewport>
        <Silian_SelectScrollDownButton />
      </Silian_SelectPrimitive.Content>
    </Silian_SelectPrimitive.Portal>
  );
}

function Silian_SelectLabel({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_SelectPrimitive.Label
      data-slot="select-label"
      className={Silian_cn("text-muted-foreground px-2 py-1.5 text-xs", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SelectItem({
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_SelectPrimitive.Item
      data-slot="select-item"
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        Silian_className
      )}
      {...Silian_props}>
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <Silian_SelectPrimitive.ItemIndicator>
          <Silian_CheckIcon className="size-4" />
        </Silian_SelectPrimitive.ItemIndicator>
      </span>
      <Silian_SelectPrimitive.ItemText>{Silian_children}</Silian_SelectPrimitive.ItemText>
    </Silian_SelectPrimitive.Item>
  );
}

function Silian_SelectSeparator({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_SelectPrimitive.Separator
      data-slot="select-separator"
      className={Silian_cn("bg-border pointer-events-none -mx-1 my-1 h-px", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SelectScrollUpButton({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={Silian_cn("flex cursor-default items-center justify-center py-1", Silian_className)}
      {...Silian_props}>
      <Silian_ChevronUpIcon className="size-4" />
    </Silian_SelectPrimitive.ScrollUpButton>
  );
}

function Silian_SelectScrollDownButton({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={Silian_cn("flex cursor-default items-center justify-center py-1", Silian_className)}
      {...Silian_props}>
      <Silian_ChevronDownIcon className="size-4" />
    </Silian_SelectPrimitive.ScrollDownButton>
  );
}

export {
  Silian_Select as Select,
  Silian_SelectContent as SelectContent,
  Silian_SelectGroup as SelectGroup,
  Silian_SelectItem as SelectItem,
  Silian_SelectLabel as SelectLabel,
  Silian_SelectScrollDownButton as SelectScrollDownButton,
  Silian_SelectScrollUpButton as SelectScrollUpButton,
  Silian_SelectSeparator as SelectSeparator,
  Silian_SelectTrigger as SelectTrigger,
  Silian_SelectValue as SelectValue,
}
