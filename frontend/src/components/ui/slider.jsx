"use client"

import * as Silian_React from "react"
import * as Silian_SliderPrimitive from "@radix-ui/react-slider"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Slider({
  className: Silian_className,
  defaultValue: Silian_defaultValue,
  value: Silian_value,
  min: Silian_min = 0,
  max: Silian_max = 100,
  ...Silian_props
}) {
  const Silian__values = Silian_React.useMemo(() =>
    Array.isArray(Silian_value)
      ? Silian_value
      : Array.isArray(Silian_defaultValue)
        ? Silian_defaultValue
        : [Silian_min, Silian_max], [Silian_value, Silian_defaultValue, Silian_min, Silian_max])

  return (
    <Silian_SliderPrimitive.Root
      data-slot="slider"
      defaultValue={Silian_defaultValue}
      value={Silian_value}
      min={Silian_min}
      max={Silian_max}
      className={Silian_cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        Silian_className
      )}
      {...Silian_props}>
      <Silian_SliderPrimitive.Track
        data-slot="slider-track"
        className={Silian_cn(
          "bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}>
        <Silian_SliderPrimitive.Range
          data-slot="slider-range"
          className={Silian_cn(
            "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )} />
      </Silian_SliderPrimitive.Track>
      {Array.from({ length: Silian__values.length }, (Silian__, Silian_index) => (
        <Silian_SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={Silian_index}
          className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50" />
      ))}
    </Silian_SliderPrimitive.Root>
  );
}

export { Silian_Slider as Slider }
