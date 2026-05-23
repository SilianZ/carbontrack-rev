import * as Silian_React from "react"
import * as Silian_TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_TooltipProvider({
  delayDuration: Silian_delayDuration = 0,
  ...Silian_props
}) {
  return (<Silian_TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={Silian_delayDuration} {...Silian_props} />);
}

function Silian_Tooltip({
  ...Silian_props
}) {
  return (
    <Silian_TooltipProvider>
      <Silian_TooltipPrimitive.Root data-slot="tooltip" {...Silian_props} />
    </Silian_TooltipProvider>
  );
}

function Silian_TooltipTrigger({
  ...Silian_props
}) {
  return <Silian_TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...Silian_props} />;
}

function Silian_TooltipContent({
  className: Silian_className,
  sideOffset: Silian_sideOffset = 0,
  children: Silian_children,
  ...Silian_props
}) {
  return (
    <Silian_TooltipPrimitive.Portal>
      <Silian_TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={Silian_sideOffset}
        className={Silian_cn(
          "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          Silian_className
        )}
        {...Silian_props}>
        {Silian_children}
        <Silian_TooltipPrimitive.Arrow
          className="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </Silian_TooltipPrimitive.Content>
    </Silian_TooltipPrimitive.Portal>
  );
}

export { Silian_Tooltip as Tooltip, Silian_TooltipTrigger as TooltipTrigger, Silian_TooltipContent as TooltipContent, Silian_TooltipProvider as TooltipProvider }
