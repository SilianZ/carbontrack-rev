"use client"

import * as Silian_React from "react"
import * as Silian_ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { CheckIcon as Silian_CheckIcon, ChevronRightIcon as Silian_ChevronRightIcon, CircleIcon as Silian_CircleIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_ContextMenu({
  ...Silian_props
}) {
  return <Silian_ContextMenuPrimitive.Root data-slot="context-menu" {...Silian_props} />;
}

function Silian_ContextMenuTrigger({
  ...Silian_props
}) {
  return (<Silian_ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...Silian_props} />);
}

function Silian_ContextMenuGroup({
  ...Silian_props
}) {
  return (<Silian_ContextMenuPrimitive.Group data-slot="context-menu-group" {...Silian_props} />);
}

function Silian_ContextMenuPortal({
  ...Silian_props
}) {
  return (<Silian_ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...Silian_props} />);
}

function Silian_ContextMenuSub({
  ...Silian_props
}) {
  return <Silian_ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...Silian_props} />;
}

function Silian_ContextMenuRadioGroup({
  ...Silian_props
}) {
  return (<Silian_ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...Silian_props} />);
}

function Silian_ContextMenuSubTrigger({
  className: Silian_className,
  inset: Silian_inset,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={Silian_inset}
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props}>
      {Silian_children}
      <Silian_ChevronRightIcon className="ml-auto" />
    </Silian_ContextMenuPrimitive.SubTrigger>
  );
}

function Silian_ContextMenuSubContent({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_ContextMenuPrimitive.SubContent
      data-slot="context-menu-sub-content"
      className={Silian_cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_ContextMenuContent({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_ContextMenuPrimitive.Portal>
      <Silian_ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        className={Silian_cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-context-menu-content-available-height) min-w-[8rem] origin-(--radix-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
          Silian_className
        )}
        {...Silian_props} />
    </Silian_ContextMenuPrimitive.Portal>
  );
}

function Silian_ContextMenuItem({
  className: Silian_className,
  inset: Silian_inset,
  variant: Silian_variant = "default",
  ...Silian_props
}) {
  return (
    <Silian_ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={Silian_inset}
      data-variant={Silian_variant}
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_ContextMenuCheckboxItem({
  className: Silian_className,
  children: Silian_children,
  checked: Silian_checked,
  ...Silian_props
}) {
  return (
    <Silian_ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      checked={Silian_checked}
      {...Silian_props}>
      <span
        className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Silian_ContextMenuPrimitive.ItemIndicator>
          <Silian_CheckIcon className="size-4" />
        </Silian_ContextMenuPrimitive.ItemIndicator>
      </span>
      {Silian_children}
    </Silian_ContextMenuPrimitive.CheckboxItem>
  );
}

function Silian_ContextMenuRadioItem({
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props}>
      <span
        className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Silian_ContextMenuPrimitive.ItemIndicator>
          <Silian_CircleIcon className="size-2 fill-current" />
        </Silian_ContextMenuPrimitive.ItemIndicator>
      </span>
      {Silian_children}
    </Silian_ContextMenuPrimitive.RadioItem>
  );
}

function Silian_ContextMenuLabel({
  className: Silian_className,
  inset: Silian_inset,
  ...Silian_props
}) {
  return (
    <Silian_ContextMenuPrimitive.Label
      data-slot="context-menu-label"
      data-inset={Silian_inset}
      className={Silian_cn(
        "text-foreground px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_ContextMenuSeparator({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={Silian_cn("bg-border -mx-1 my-1 h-px", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_ContextMenuShortcut({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={Silian_cn("text-muted-foreground ml-auto text-xs tracking-widest", Silian_className)}
      {...Silian_props} />
  );
}

export {
  Silian_ContextMenu as ContextMenu,
  Silian_ContextMenuTrigger as ContextMenuTrigger,
  Silian_ContextMenuContent as ContextMenuContent,
  Silian_ContextMenuItem as ContextMenuItem,
  Silian_ContextMenuCheckboxItem as ContextMenuCheckboxItem,
  Silian_ContextMenuRadioItem as ContextMenuRadioItem,
  Silian_ContextMenuLabel as ContextMenuLabel,
  Silian_ContextMenuSeparator as ContextMenuSeparator,
  Silian_ContextMenuShortcut as ContextMenuShortcut,
  Silian_ContextMenuGroup as ContextMenuGroup,
  Silian_ContextMenuPortal as ContextMenuPortal,
  Silian_ContextMenuSub as ContextMenuSub,
  Silian_ContextMenuSubContent as ContextMenuSubContent,
  Silian_ContextMenuSubTrigger as ContextMenuSubTrigger,
  Silian_ContextMenuRadioGroup as ContextMenuRadioGroup,
}
