"use client"

import * as Silian_React from "react"
import { OTPInput as Silian_OTPInput, OTPInputContext as Silian_OTPInputContext } from "input-otp"
import { MinusIcon as Silian_MinusIcon } from "lucide-react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_InputOTP({
  className: Silian_className,
  containerClassName: Silian_containerClassName,
  ...Silian_props
}) {
  return (
    <Silian_OTPInput
      data-slot="input-otp"
      containerClassName={Silian_cn("flex items-center gap-2 has-disabled:opacity-50", Silian_containerClassName)}
      className={Silian_cn("disabled:cursor-not-allowed", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_InputOTPGroup({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div
      data-slot="input-otp-group"
      className={Silian_cn("flex items-center", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_InputOTPSlot({
  index: Silian_index,
  className: Silian_className,
  ...Silian_props
}) {
  const Silian_inputOTPContext = Silian_React.useContext(Silian_OTPInputContext)
  const { char: Silian_char, hasFakeCaret: Silian_hasFakeCaret, isActive: Silian_isActive } = Silian_inputOTPContext?.slots[Silian_index] ?? {}

  return (
    <div
      data-slot="input-otp-slot"
      data-active={Silian_isActive}
      className={Silian_cn(
        "data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 dark:data-[active=true]:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive dark:bg-input/30 border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]",
        Silian_className
      )}
      {...Silian_props}>
      {Silian_char}
      {Silian_hasFakeCaret && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

function Silian_InputOTPSeparator({
  ...Silian_props
}) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...Silian_props}>
      <Silian_MinusIcon />
    </div>
  );
}

export { Silian_InputOTP as InputOTP, Silian_InputOTPGroup as InputOTPGroup, Silian_InputOTPSlot as InputOTPSlot, Silian_InputOTPSeparator as InputOTPSeparator }
