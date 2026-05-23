import * as Silian_React from "react"
import * as Silian_MenubarPrimitive from "@radix-ui/react-menubar"
import { CheckIcon as Silian_CheckIcon, ChevronRightIcon as Silian_ChevronRightIcon, CircleIcon as Silian_CircleIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Menubar({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.Root
      data-slot="menubar"
      className={Silian_cn(
        "bg-background flex h-9 items-center gap-1 rounded-md border p-1 shadow-xs",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_MenubarMenu({
  ...Silian_props
}) {
  return <Silian_MenubarPrimitive.Menu data-slot="menubar-menu" {...Silian_props} />;
}

function Silian_MenubarGroup({
  ...Silian_props
}) {
  return <Silian_MenubarPrimitive.Group data-slot="menubar-group" {...Silian_props} />;
}

function Silian_MenubarPortal({
  ...Silian_props
}) {
  return <Silian_MenubarPrimitive.Portal data-slot="menubar-portal" {...Silian_props} />;
}

function Silian_MenubarRadioGroup({
  ...Silian_props
}) {
  return (<Silian_MenubarPrimitive.RadioGroup data-slot="menubar-radio-group" {...Silian_props} />);
}

function Silian_MenubarTrigger({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.Trigger
      data-slot="menubar-trigger"
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex items-center rounded-sm px-2 py-1 text-sm font-medium outline-hidden select-none",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_MenubarContent({
  className: Silian_className,
  align: Silian_align = "start",
  alignOffset: Silian_alignOffset = -4,
  sideOffset: Silian_sideOffset = 8,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPortal>
      <Silian_MenubarPrimitive.Content
        data-slot="menubar-content"
        align={Silian_align}
        alignOffset={Silian_alignOffset}
        sideOffset={Silian_sideOffset}
        className={Silian_cn(
          "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[12rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-md",
          Silian_className
        )}
        {...Silian_props} />
    </Silian_MenubarPortal>
  );
}

function Silian_MenubarItem({
  className: Silian_className,
  inset: Silian_inset,
  variant: Silian_variant = "default",
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.Item
      data-slot="menubar-item"
      data-inset={Silian_inset}
      data-variant={Silian_variant}
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_MenubarCheckboxItem({
  className: Silian_className,
  children: Silian_children,
  checked: Silian_checked,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      checked={Silian_checked}
      {...Silian_props}>
      <span
        className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Silian_MenubarPrimitive.ItemIndicator>
          <Silian_CheckIcon className="size-4" />
        </Silian_MenubarPrimitive.ItemIndicator>
      </span>
      {Silian_children}
    </Silian_MenubarPrimitive.CheckboxItem>
  );
}

function Silian_MenubarRadioItem({
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.RadioItem
      data-slot="menubar-radio-item"
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props}>
      <span
        className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Silian_MenubarPrimitive.ItemIndicator>
          <Silian_CircleIcon className="size-2 fill-current" />
        </Silian_MenubarPrimitive.ItemIndicator>
      </span>
      {Silian_children}
    </Silian_MenubarPrimitive.RadioItem>
  );
}

function Silian_MenubarLabel({
  className: Silian_className,
  inset: Silian_inset,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.Label
      data-slot="menubar-label"
      data-inset={Silian_inset}
      className={Silian_cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_MenubarSeparator({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.Separator
      data-slot="menubar-separator"
      className={Silian_cn("bg-border -mx-1 my-1 h-px", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_MenubarShortcut({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={Silian_cn("text-muted-foreground ml-auto text-xs tracking-widest", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_MenubarSub({
  ...Silian_props
}) {
  return <Silian_MenubarPrimitive.Sub data-slot="menubar-sub" {...Silian_props} />;
}

function Silian_MenubarSubTrigger({
  className: Silian_className,
  inset: Silian_inset,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.SubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={Silian_inset}
      className={Silian_cn(
        "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none data-[inset]:pl-8",
        Silian_className
      )}
      {...Silian_props}>
      {Silian_children}
      <Silian_ChevronRightIcon className="ml-auto h-4 w-4" />
    </Silian_MenubarPrimitive.SubTrigger>
  );
}

function Silian_MenubarSubContent({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_MenubarPrimitive.SubContent
      data-slot="menubar-sub-content"
      className={Silian_cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-menubar-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg",
        Silian_className
      )}
      {...Silian_props} />
  );
}

export {
  Silian_Menubar as Menubar,
  Silian_MenubarPortal as MenubarPortal,
  Silian_MenubarMenu as MenubarMenu,
  Silian_MenubarTrigger as MenubarTrigger,
  Silian_MenubarContent as MenubarContent,
  Silian_MenubarGroup as MenubarGroup,
  Silian_MenubarSeparator as MenubarSeparator,
  Silian_MenubarLabel as MenubarLabel,
  Silian_MenubarItem as MenubarItem,
  Silian_MenubarShortcut as MenubarShortcut,
  Silian_MenubarCheckboxItem as MenubarCheckboxItem,
  Silian_MenubarRadioGroup as MenubarRadioGroup,
  Silian_MenubarRadioItem as MenubarRadioItem,
  Silian_MenubarSub as MenubarSub,
  Silian_MenubarSubTrigger as MenubarSubTrigger,
  Silian_MenubarSubContent as MenubarSubContent,
}
