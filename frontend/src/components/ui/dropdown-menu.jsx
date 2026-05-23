"use client"

import * as Silian_React from "react"
import * as Silian_DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon as Silian_CheckIcon, ChevronRightIcon as Silian_ChevronRightIcon, CircleIcon as Silian_CircleIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_DropdownMenu({
  ...Silian_props
}) {
  return <Silian_DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...Silian_props} />;
}

function Silian_DropdownMenuPortal({
  ...Silian_props
}) {
  return (<Silian_DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...Silian_props} />);
}

function Silian_DropdownMenuTrigger({
  ...Silian_props
}) {
  return (<Silian_DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...Silian_props} />);
}

function Silian_DropdownMenuContent({
  className: Silian_className,
  sideOffset: Silian_sideOffset = 4,
  ...Silian_props
}) {
  return (
    <Silian_DropdownMenuPrimitive.Portal>
      <Silian_DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={Silian_sideOffset}
        className={Silian_cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
          Silian_className
        )}
        {...Silian_props} />
    </Silian_DropdownMenuPrimitive.Portal>
  );
}

function Silian_DropdownMenuGroup({
  ...Silian_props
}) {
  return (<Silian_DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...Silian_props} />);
}

function Silian_DropdownMenuItem({
  className: Silian_className,
  inset: Silian_inset,
  variant: Silian_variant = "default",
  ...Silian_props
}) {
  return (
    <Silian_DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={Silian_inset}
      data-variant={Silian_variant}
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_DropdownMenuCheckboxItem({
  className: Silian_className,
  children: Silian_children,
  checked: Silian_checked,
  ...Silian_props
}) {
  return (
    <Silian_DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      checked={Silian_checked}
      {...Silian_props}>
      <span
        className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Silian_DropdownMenuPrimitive.ItemIndicator>
          <Silian_CheckIcon className="size-4" />
        </Silian_DropdownMenuPrimitive.ItemIndicator>
      </span>
      {Silian_children}
    </Silian_DropdownMenuPrimitive.CheckboxItem>
  );
}

function Silian_DropdownMenuRadioGroup({
  ...Silian_props
}) {
  return (<Silian_DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...Silian_props} />);
}

function Silian_DropdownMenuRadioItem({
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props}>
      <span
        className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Silian_DropdownMenuPrimitive.ItemIndicator>
          <Silian_CircleIcon className="size-2 fill-current" />
        </Silian_DropdownMenuPrimitive.ItemIndicator>
      </span>
      {Silian_children}
    </Silian_DropdownMenuPrimitive.RadioItem>
  );
}

function Silian_DropdownMenuLabel({
  className: Silian_className,
  inset: Silian_inset,
  ...Silian_props
}) {
  return (
    <Silian_DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={Silian_inset}
      className={Silian_cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_DropdownMenuSeparator({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={Silian_cn("bg-border -mx-1 my-1 h-px", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_DropdownMenuShortcut({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={Silian_cn("text-muted-foreground ml-auto text-xs tracking-widest", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_DropdownMenuSub({
  ...Silian_props
}) {
  return <Silian_DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...Silian_props} />;
}

function Silian_DropdownMenuSubTrigger({
  className: Silian_className,
  inset: Silian_inset,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={Silian_inset}
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8",
        Silian_className
      )}
      {...Silian_props}>
      {Silian_children}
      <Silian_ChevronRightIcon className="ml-auto size-4" />
    </Silian_DropdownMenuPrimitive.SubTrigger>
  );
}

function Silian_DropdownMenuSubContent({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={Silian_cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        Silian_className
      )}
      {...Silian_props} />
  );
}

export {
  Silian_DropdownMenu as DropdownMenu,
  Silian_DropdownMenuPortal as DropdownMenuPortal,
  Silian_DropdownMenuTrigger as DropdownMenuTrigger,
  Silian_DropdownMenuContent as DropdownMenuContent,
  Silian_DropdownMenuGroup as DropdownMenuGroup,
  Silian_DropdownMenuLabel as DropdownMenuLabel,
  Silian_DropdownMenuItem as DropdownMenuItem,
  Silian_DropdownMenuCheckboxItem as DropdownMenuCheckboxItem,
  Silian_DropdownMenuRadioGroup as DropdownMenuRadioGroup,
  Silian_DropdownMenuRadioItem as DropdownMenuRadioItem,
  Silian_DropdownMenuSeparator as DropdownMenuSeparator,
  Silian_DropdownMenuShortcut as DropdownMenuShortcut,
  Silian_DropdownMenuSub as DropdownMenuSub,
  Silian_DropdownMenuSubTrigger as DropdownMenuSubTrigger,
  Silian_DropdownMenuSubContent as DropdownMenuSubContent,
}
