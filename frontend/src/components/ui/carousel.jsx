"use client";
import * as Silian_React from "react"
import Silian_useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft as Silian_ArrowLeft, ArrowRight as Silian_ArrowRight } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"
import { Button as Silian_Button } from "@/components/ui/Button"

const Silian_CarouselContext = Silian_React.createContext(null)

function Silian_useCarousel() {
  const Silian_context = Silian_React.useContext(Silian_CarouselContext)

  if (!Silian_context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }

  return Silian_context
}

function Silian_Carousel({
  orientation: Silian_orientation = "horizontal",
  opts: Silian_opts,
  setApi: Silian_setApi,
  plugins: Silian_plugins,
  className: Silian_className,
  children: Silian_children,
  ...Silian_props
}) {
  const [Silian_carouselRef, Silian_api] = Silian_useEmblaCarousel({
    ...Silian_opts,
    axis: Silian_orientation === "horizontal" ? "x" : "y",
  }, Silian_plugins)
  const [Silian_canScrollPrev, Silian_setCanScrollPrev] = Silian_React.useState(false)
  const [Silian_canScrollNext, Silian_setCanScrollNext] = Silian_React.useState(false)

  const Silian_onSelect = Silian_React.useCallback((Silian_api) => {
    if (!Silian_api) return
    Silian_setCanScrollPrev(Silian_api.canScrollPrev())
    Silian_setCanScrollNext(Silian_api.canScrollNext())
  }, [])

  const Silian_scrollPrev = Silian_React.useCallback(() => {
    Silian_api?.scrollPrev()
  }, [Silian_api])

  const Silian_scrollNext = Silian_React.useCallback(() => {
    Silian_api?.scrollNext()
  }, [Silian_api])

  const Silian_handleKeyDown = Silian_React.useCallback((Silian_event) => {
    if (Silian_event.key === "ArrowLeft") {
      Silian_event.preventDefault()
      Silian_scrollPrev()
    } else if (Silian_event.key === "ArrowRight") {
      Silian_event.preventDefault()
      Silian_scrollNext()
    }
  }, [Silian_scrollPrev, Silian_scrollNext])

  Silian_React.useEffect(() => {
    if (!Silian_api || !Silian_setApi) return
    Silian_setApi(Silian_api)
  }, [Silian_api, Silian_setApi])

  Silian_React.useEffect(() => {
    if (!Silian_api) return
    Silian_onSelect(Silian_api)
    Silian_api.on("reInit", Silian_onSelect)
    Silian_api.on("select", Silian_onSelect)

    return () => {
      Silian_api?.off("select", Silian_onSelect)
    };
  }, [Silian_api, Silian_onSelect])

  return (
    <Silian_CarouselContext.Provider
      value={{
        carouselRef: Silian_carouselRef,
        api: Silian_api,
        opts: Silian_opts,
        orientation:
          Silian_orientation || (Silian_opts?.axis === "y" ? "vertical" : "horizontal"),
        scrollPrev: Silian_scrollPrev,
        scrollNext: Silian_scrollNext,
        canScrollPrev: Silian_canScrollPrev,
        canScrollNext: Silian_canScrollNext,
      }}>
      <div
        onKeyDownCapture={Silian_handleKeyDown}
        className={Silian_cn("relative", Silian_className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...Silian_props}>
        {Silian_children}
      </div>
    </Silian_CarouselContext.Provider>
  );
}

function Silian_CarouselContent({
  className: Silian_className,
  ...Silian_props
}) {
  const { carouselRef: Silian_carouselRef, orientation: Silian_orientation } = Silian_useCarousel()

  return (
    <div
      ref={Silian_carouselRef}
      className="overflow-hidden"
      data-slot="carousel-content">
      <div
        className={Silian_cn(
          "flex",
          Silian_orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          Silian_className
        )}
        {...Silian_props} />
    </div>
  );
}

function Silian_CarouselItem({
  className: Silian_className,
  ...Silian_props
}) {
  const { orientation: Silian_orientation } = Silian_useCarousel()

  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={Silian_cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        Silian_orientation === "horizontal" ? "pl-4" : "pt-4",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_CarouselPrevious({
  className: Silian_className,
  variant: Silian_variant = "outline",
  size: Silian_size = "icon",
  ...Silian_props
}) {
  const { orientation: Silian_orientation, scrollPrev: Silian_scrollPrev, canScrollPrev: Silian_canScrollPrev } = Silian_useCarousel()

  return (
    <Silian_Button
      data-slot="carousel-previous"
      variant={Silian_variant}
      size={Silian_size}
      className={Silian_cn("absolute size-8 rounded-full", Silian_orientation === "horizontal"
        ? "top-1/2 -left-12 -translate-y-1/2"
        : "-top-12 left-1/2 -translate-x-1/2 rotate-90", Silian_className)}
      disabled={!Silian_canScrollPrev}
      onClick={Silian_scrollPrev}
      {...Silian_props}>
      <Silian_ArrowLeft />
      <span className="sr-only">Previous slide</span>
    </Silian_Button>
  );
}

function Silian_CarouselNext({
  className: Silian_className,
  variant: Silian_variant = "outline",
  size: Silian_size = "icon",
  ...Silian_props
}) {
  const { orientation: Silian_orientation, scrollNext: Silian_scrollNext, canScrollNext: Silian_canScrollNext } = Silian_useCarousel()

  return (
    <Silian_Button
      data-slot="carousel-next"
      variant={Silian_variant}
      size={Silian_size}
      className={Silian_cn("absolute size-8 rounded-full", Silian_orientation === "horizontal"
        ? "top-1/2 -right-12 -translate-y-1/2"
        : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90", Silian_className)}
      disabled={!Silian_canScrollNext}
      onClick={Silian_scrollNext}
      {...Silian_props}>
      <Silian_ArrowRight />
      <span className="sr-only">Next slide</span>
    </Silian_Button>
  );
}

export { Silian_Carousel as Carousel, Silian_CarouselContent as CarouselContent, Silian_CarouselItem as CarouselItem, Silian_CarouselPrevious as CarouselPrevious, Silian_CarouselNext as CarouselNext };
