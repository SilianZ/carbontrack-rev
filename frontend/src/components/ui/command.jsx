"use client"

import * as Silian_React from "react"
import { Command as Silian_CommandPrimitive } from "cmdk"
import { SearchIcon as Silian_SearchIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"
import {
  Dialog as Silian_Dialog,
  DialogContent as Silian_DialogContent,
  DialogDescription as Silian_DialogDescription,
  DialogHeader as Silian_DialogHeader,
  DialogTitle as Silian_DialogTitle,
} from "@/components/ui/dialog"

function Silian_Command({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_CommandPrimitive
      data-slot="command"
      className={Silian_cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_CommandDialog({
  title: Silian_title = "Command Palette",
  description: Silian_description = "Search for a command to run...",
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_Dialog {...Silian_props}>
      <Silian_DialogHeader className="sr-only">
        <Silian_DialogTitle>{Silian_title}</Silian_DialogTitle>
        <Silian_DialogDescription>{Silian_description}</Silian_DialogDescription>
      </Silian_DialogHeader>
      <Silian_DialogContent className="overflow-hidden p-0">
        <Silian_Command
          className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {Silian_children}
        </Silian_Command>
      </Silian_DialogContent>
    </Silian_Dialog>
  );
}

function Silian_CommandInput({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-b px-3">
      <Silian_SearchIcon className="size-4 shrink-0 opacity-50" />
      <Silian_CommandPrimitive.Input
        data-slot="command-input"
        className={Silian_cn(
          "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          Silian_className
        )}
        {...Silian_props} />
    </div>
  );
}

function Silian_CommandList({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_CommandPrimitive.List
      data-slot="command-list"
      className={Silian_cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_CommandEmpty({
  ...Silian_props
}) {
  return (<Silian_CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-center text-sm" {...Silian_props} />);
}

function Silian_CommandGroup({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_CommandPrimitive.Group
      data-slot="command-group"
      className={Silian_cn(
        "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_CommandSeparator({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_CommandPrimitive.Separator
      data-slot="command-separator"
      className={Silian_cn("bg-border -mx-1 h-px", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_CommandItem({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_CommandPrimitive.Item
      data-slot="command-item"
      className={Silian_cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_CommandShortcut({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <span
      data-slot="command-shortcut"
      className={Silian_cn("text-muted-foreground ml-auto text-xs tracking-widest", Silian_className)}
      {...Silian_props} />
  );
}

export {
  Silian_Command as Command,
  Silian_CommandDialog as CommandDialog,
  Silian_CommandInput as CommandInput,
  Silian_CommandList as CommandList,
  Silian_CommandEmpty as CommandEmpty,
  Silian_CommandGroup as CommandGroup,
  Silian_CommandItem as CommandItem,
  Silian_CommandShortcut as CommandShortcut,
  Silian_CommandSeparator as CommandSeparator,
}
