import * as Silian_React from "react"
import { GripVerticalIcon as Silian_GripVerticalIcon } from "lucide-react"
import * as Silian_ResizablePrimitive from "react-resizable-panels"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_ResizablePanelGroup({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_ResizablePrimitive.PanelGroup
      data-slot="resizable-panel-group"
      className={Silian_cn(
        "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_ResizablePanel({
  ...Silian_props
}) {
  return <Silian_ResizablePrimitive.Panel data-slot="resizable-panel" {...Silian_props} />;
}

function Silian_ResizableHandle({
  withHandle: Silian_withHandle,
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={Silian_cn(
        "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
        Silian_className
      )}
      {...Silian_props}>
      {Silian_withHandle && (
        <div
          className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border">
          <Silian_GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </Silian_ResizablePrimitive.PanelResizeHandle>
  );
}

export { Silian_ResizablePanelGroup as ResizablePanelGroup, Silian_ResizablePanel as ResizablePanel, Silian_ResizableHandle as ResizableHandle }
