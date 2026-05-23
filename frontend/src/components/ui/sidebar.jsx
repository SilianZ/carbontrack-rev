"use client";
import * as Silian_React from "react"
import { Slot as Silian_Slot } from "@radix-ui/react-slot"
import { cva as Silian_cva } from "class-variance-authority";
import { PanelLeftIcon as Silian_PanelLeftIcon } from "lucide-react"

import { useIsMobile as Silian_useIsMobile } from "@/hooks/use-mobile"
import { cn as Silian_cn } from "@/lib/utils"
import { Button as Silian_Button } from "@/components/ui/Button"
import { Input as Silian_Input } from "@/components/ui/Input"
import { Separator as Silian_Separator } from "@/components/ui/separator"
import {
  Sheet as Silian_Sheet,
  SheetContent as Silian_SheetContent,
  SheetDescription as Silian_SheetDescription,
  SheetHeader as Silian_SheetHeader,
  SheetTitle as Silian_SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton as Silian_Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip as Silian_Tooltip,
  TooltipContent as Silian_TooltipContent,
  TooltipProvider as Silian_TooltipProvider,
  TooltipTrigger as Silian_TooltipTrigger,
} from "@/components/ui/tooltip"

const Silian_SIDEBAR_COOKIE_NAME = "sidebar_state"
const Silian_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const Silian_SIDEBAR_WIDTH = "16rem"
const Silian_SIDEBAR_WIDTH_MOBILE = "18rem"
const Silian_SIDEBAR_WIDTH_ICON = "3rem"
const Silian_SIDEBAR_KEYBOARD_SHORTCUT = "b"

const Silian_SidebarContext = Silian_React.createContext(null)

function Silian_useSidebar() {
  const Silian_context = Silian_React.useContext(Silian_SidebarContext)
  if (!Silian_context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return Silian_context
}

function Silian_SidebarProvider({
  defaultOpen: Silian_defaultOpen = true,
  open: Silian_openProp,
  onOpenChange: Silian_setOpenProp,
  className: Silian_className,
  style: Silian_style,
  children: Silian_children,
  ...Silian_props
}) {
  const Silian_isMobile = Silian_useIsMobile()
  const [Silian_openMobile, Silian_setOpenMobile] = Silian_React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [Silian__open, Silian__setOpen] = Silian_React.useState(Silian_defaultOpen)
  const Silian_open = Silian_openProp ?? Silian__open
  const Silian_setOpen = Silian_React.useCallback((Silian_value) => {
    const Silian_openState = typeof Silian_value === "function" ? Silian_value(Silian_open) : Silian_value
    if (Silian_setOpenProp) {
      Silian_setOpenProp(Silian_openState)
    } else {
      Silian__setOpen(Silian_openState)
    }

    // This sets the cookie to keep the sidebar state.
    document.cookie = `${Silian_SIDEBAR_COOKIE_NAME}=${Silian_openState}; path=/; max-age=${Silian_SIDEBAR_COOKIE_MAX_AGE}`
  }, [Silian_setOpenProp, Silian_open])

  // Helper to toggle the sidebar.
  const Silian_toggleSidebar = Silian_React.useCallback(() => {
    return Silian_isMobile ? Silian_setOpenMobile((Silian_open) => !Silian_open) : Silian_setOpen((Silian_open) => !Silian_open);
  }, [Silian_isMobile, Silian_setOpen, Silian_setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  Silian_React.useEffect(() => {
    const Silian_handleKeyDown = (Silian_event) => {
      if (
        Silian_event.key === Silian_SIDEBAR_KEYBOARD_SHORTCUT &&
        (Silian_event.metaKey || Silian_event.ctrlKey)
      ) {
        Silian_event.preventDefault()
        Silian_toggleSidebar()
      }
    }

    window.addEventListener("keydown", Silian_handleKeyDown)
    return () => window.removeEventListener("keydown", Silian_handleKeyDown);
  }, [Silian_toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const Silian_state = Silian_open ? "expanded" : "collapsed"

  const Silian_contextValue = Silian_React.useMemo(() => ({
    state: Silian_state,
    open: Silian_open,
    setOpen: Silian_setOpen,
    isMobile: Silian_isMobile,
    openMobile: Silian_openMobile,
    setOpenMobile: Silian_setOpenMobile,
    toggleSidebar: Silian_toggleSidebar,
  }), [Silian_state, Silian_open, Silian_setOpen, Silian_isMobile, Silian_openMobile, Silian_setOpenMobile, Silian_toggleSidebar])

  return (
    <Silian_SidebarContext.Provider value={Silian_contextValue}>
      <Silian_TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": Silian_SIDEBAR_WIDTH,
              "--sidebar-width-icon": Silian_SIDEBAR_WIDTH_ICON,
              ...Silian_style
            }
          }
          className={Silian_cn(
            "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
            Silian_className
          )}
          {...Silian_props}>
          {Silian_children}
        </div>
      </Silian_TooltipProvider>
    </Silian_SidebarContext.Provider>
  );
}

function Silian_Sidebar({
  side: Silian_side = "left",
  variant: Silian_variant = "sidebar",
  collapsible: Silian_collapsible = "offcanvas",
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  const { isMobile: Silian_isMobile, state: Silian_state, openMobile: Silian_openMobile, setOpenMobile: Silian_setOpenMobile } = Silian_useSidebar()

  if (Silian_collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={Silian_cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
          Silian_className
        )}
        {...Silian_props}>
        {Silian_children}
      </div>
    );
  }

  if (Silian_isMobile) {
    return (
      <Silian_Sheet open={Silian_openMobile} onOpenChange={Silian_setOpenMobile} {...Silian_props}>
        <Silian_SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
          style={
            {
              "--sidebar-width": Silian_SIDEBAR_WIDTH_MOBILE
            }
          }
          side={Silian_side}>
          <Silian_SheetHeader className="sr-only">
            <Silian_SheetTitle>Sidebar</Silian_SheetTitle>
            <Silian_SheetDescription>Displays the mobile sidebar.</Silian_SheetDescription>
          </Silian_SheetHeader>
          <div className="flex h-full w-full flex-col">{Silian_children}</div>
        </Silian_SheetContent>
      </Silian_Sheet>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={Silian_state}
      data-collapsible={Silian_state === "collapsed" ? Silian_collapsible : ""}
      data-variant={Silian_variant}
      data-side={Silian_side}
      data-slot="sidebar">
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={Silian_cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          Silian_variant === "floating" || Silian_variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )} />
      <div
        data-slot="sidebar-container"
        className={Silian_cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          Silian_side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          Silian_variant === "floating" || Silian_variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          Silian_className
        )}
        {...Silian_props}>
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm">
          {Silian_children}
        </div>
      </div>
    </div>
  );
}

function Silian_SidebarTrigger({
  className: Silian_className,
  onClick: Silian_onClick,
  ...Silian_props
}) {
  const { toggleSidebar: Silian_toggleSidebar } = Silian_useSidebar()

  return (
    <Silian_Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={Silian_cn("size-7", Silian_className)}
      onClick={(Silian_event) => {
        Silian_onClick?.(Silian_event)
        Silian_toggleSidebar()
      }}
      {...Silian_props}>
      <Silian_PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Silian_Button>
  );
}

function Silian_SidebarRail({
  className: Silian_className,
  ...Silian_props
}) {
  const { toggleSidebar: Silian_toggleSidebar } = Silian_useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={Silian_toggleSidebar}
      title="Toggle Sidebar"
      className={Silian_cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SidebarInset({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <main
      data-slot="sidebar-inset"
      className={Silian_cn(
        "bg-background relative flex w-full flex-1 flex-col",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SidebarInput({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={Silian_cn("bg-background h-8 w-full shadow-none", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SidebarHeader({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={Silian_cn("flex flex-col gap-2 p-2", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SidebarFooter({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={Silian_cn("flex flex-col gap-2 p-2", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SidebarSeparator({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <Silian_Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={Silian_cn("bg-sidebar-border mx-2 w-auto", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SidebarContent({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={Silian_cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SidebarGroup({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={Silian_cn("relative flex w-full min-w-0 flex-col p-2", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SidebarGroupLabel({
  className: Silian_className,
  asChild: Silian_asChild = false,
  ...Silian_props
}) {
  const Silian_Comp = Silian_asChild ? Silian_Slot : "div"

  return (
    <Silian_Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={Silian_cn(
        "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SidebarGroupAction({
  className: Silian_className,
  asChild: Silian_asChild = false,
  ...Silian_props
}) {
  const Silian_Comp = Silian_asChild ? Silian_Slot : "button"

  return (
    <Silian_Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={Silian_cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SidebarGroupContent({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={Silian_cn("w-full text-sm", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SidebarMenu({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={Silian_cn("flex w-full min-w-0 flex-col gap-1", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SidebarMenuItem({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={Silian_cn("group/menu-item relative", Silian_className)}
      {...Silian_props} />
  );
}

const Silian_sidebarMenuButtonVariants = Silian_cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Silian_SidebarMenuButton({
  asChild: Silian_asChild = false,
  isActive: Silian_isActive = false,
  variant: Silian_variant = "default",
  size: Silian_size = "default",
  tooltip: Silian_tooltip,
  className: Silian_className,
  ...Silian_props
}) {
  const Silian_Comp = Silian_asChild ? Silian_Slot : "button"
  const { isMobile: Silian_isMobile, state: Silian_state } = Silian_useSidebar()

  const Silian_button = (
    <Silian_Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={Silian_size}
      data-active={Silian_isActive}
      className={Silian_cn(Silian_sidebarMenuButtonVariants({ variant: Silian_variant, size: Silian_size }), Silian_className)}
      {...Silian_props} />
  )

  if (!Silian_tooltip) {
    return Silian_button
  }

  if (typeof Silian_tooltip === "string") {
    Silian_tooltip = {
      children: Silian_tooltip,
    }
  }

  return (
    <Silian_Tooltip>
      <Silian_TooltipTrigger asChild>{Silian_button}</Silian_TooltipTrigger>
      <Silian_TooltipContent
        side="right"
        align="center"
        hidden={Silian_state !== "collapsed" || Silian_isMobile}
        {...Silian_tooltip} />
    </Silian_Tooltip>
  );
}

function Silian_SidebarMenuAction({
  className: Silian_className,
  asChild: Silian_asChild = false,
  showOnHover: Silian_showOnHover = false,
  ...Silian_props
}) {
  const Silian_Comp = Silian_asChild ? Silian_Slot : "button"

  return (
    <Silian_Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={Silian_cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        Silian_showOnHover &&
          "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SidebarMenuBadge({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={Silian_cn(
        "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SidebarMenuSkeleton({
  className: Silian_className,
  showIcon: Silian_showIcon = false,
  ...Silian_props
}) {
  // Random width between 50 to 90%.
  const Silian_width = Silian_React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`;
  }, [])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={Silian_cn("flex h-8 items-center gap-2 rounded-md px-2", Silian_className)}
      {...Silian_props}>
      {Silian_showIcon && (
        <Silian_Skeleton className="size-4 rounded-md" data-sidebar="menu-skeleton-icon" />
      )}
      <Silian_Skeleton
        className="h-4 max-w-(--skeleton-width) flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": Silian_width
          }
        } />
    </div>
  );
}

function Silian_SidebarMenuSub({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={Silian_cn(
        "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
        "group-data-[collapsible=icon]:hidden",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_SidebarMenuSubItem({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={Silian_cn("group/menu-sub-item relative", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_SidebarMenuSubButton({
  asChild: Silian_asChild = false,
  size: Silian_size = "md",
  isActive: Silian_isActive = false,
  className: Silian_className,
  ...Silian_props
}) {
  const Silian_Comp = Silian_asChild ? Silian_Slot : "a"

  return (
    <Silian_Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={Silian_size}
      data-active={Silian_isActive}
      className={Silian_cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        Silian_size === "sm" && "text-xs",
        Silian_size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        Silian_className
      )}
      {...Silian_props} />
  );
}

export {
  Silian_Sidebar as Sidebar,
  Silian_SidebarContent as SidebarContent,
  Silian_SidebarFooter as SidebarFooter,
  Silian_SidebarGroup as SidebarGroup,
  Silian_SidebarGroupAction as SidebarGroupAction,
  Silian_SidebarGroupContent as SidebarGroupContent,
  Silian_SidebarGroupLabel as SidebarGroupLabel,
  Silian_SidebarHeader as SidebarHeader,
  Silian_SidebarInput as SidebarInput,
  Silian_SidebarInset as SidebarInset,
  Silian_SidebarMenu as SidebarMenu,
  Silian_SidebarMenuAction as SidebarMenuAction,
  Silian_SidebarMenuBadge as SidebarMenuBadge,
  Silian_SidebarMenuButton as SidebarMenuButton,
  Silian_SidebarMenuItem as SidebarMenuItem,
  Silian_SidebarMenuSkeleton as SidebarMenuSkeleton,
  Silian_SidebarMenuSub as SidebarMenuSub,
  Silian_SidebarMenuSubButton as SidebarMenuSubButton,
  Silian_SidebarMenuSubItem as SidebarMenuSubItem,
  Silian_SidebarProvider as SidebarProvider,
  Silian_SidebarRail as SidebarRail,
  Silian_SidebarSeparator as SidebarSeparator,
  Silian_SidebarTrigger as SidebarTrigger,
}
