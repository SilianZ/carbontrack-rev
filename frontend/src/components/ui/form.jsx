import * as Silian_React from "react"
import { Slot as Silian_Slot } from "@radix-ui/react-slot"
import { Controller as Silian_Controller, FormProvider as Silian_FormProvider, useFormContext as Silian_useFormContext, useFormState as Silian_useFormState } from "react-hook-form";

import { cn as Silian_cn } from "@/lib/utils"
import { Label as Silian_Label } from "@/components/ui/label"

const Silian_Form = Silian_FormProvider

const Silian_FormFieldContext = Silian_React.createContext({})

const Silian_FormField = (
  {
    ...Silian_props
  }
) => {
  return (
    <Silian_FormFieldContext.Provider value={{ name: Silian_props.name }}>
      <Silian_Controller {...Silian_props} />
    </Silian_FormFieldContext.Provider>
  );
}

const Silian_useFormField = () => {
  const Silian_fieldContext = Silian_React.useContext(Silian_FormFieldContext)
  const Silian_itemContext = Silian_React.useContext(Silian_FormItemContext)
  const { getFieldState: Silian_getFieldState } = Silian_useFormContext()
  const Silian_formState = Silian_useFormState({ name: Silian_fieldContext.name })
  const Silian_fieldState = Silian_getFieldState(Silian_fieldContext.name, Silian_formState)

  if (!Silian_fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id: Silian_id } = Silian_itemContext

  return {
    id: Silian_id,
    name: Silian_fieldContext.name,
    formItemId: `${Silian_id}-form-item`,
    formDescriptionId: `${Silian_id}-form-item-description`,
    formMessageId: `${Silian_id}-form-item-message`,
    ...Silian_fieldState,
  }
}

const Silian_FormItemContext = Silian_React.createContext({})

function Silian_FormItem({
  className: Silian_className,
  ...Silian_props
}) {
  const Silian_id = Silian_React.useId()

  return (
    <Silian_FormItemContext.Provider value={{ id: Silian_id }}>
      <div data-slot="form-item" className={Silian_cn("grid gap-2", Silian_className)} {...Silian_props} />
    </Silian_FormItemContext.Provider>
  );
}

function Silian_FormLabel({
  className: Silian_className,
  ...Silian_props
}) {
  const { error: Silian_error, formItemId: Silian_formItemId } = Silian_useFormField()

  return (
    <Silian_Label
      data-slot="form-label"
      data-error={!!Silian_error}
      className={Silian_cn("data-[error=true]:text-destructive", Silian_className)}
      htmlFor={Silian_formItemId}
      {...Silian_props} />
  );
}

function Silian_FormControl({
  ...Silian_props
}) {
  const { error: Silian_error, formItemId: Silian_formItemId, formDescriptionId: Silian_formDescriptionId, formMessageId: Silian_formMessageId } = Silian_useFormField()

  return (
    <Silian_Slot
      data-slot="form-control"
      id={Silian_formItemId}
      aria-describedby={
        !Silian_error
          ? `${Silian_formDescriptionId}`
          : `${Silian_formDescriptionId} ${Silian_formMessageId}`
      }
      aria-invalid={!!Silian_error}
      {...Silian_props} />
  );
}

function Silian_FormDescription({
  className: Silian_className,
  ...Silian_props
}) {
  const { formDescriptionId: Silian_formDescriptionId } = Silian_useFormField()

  return (
    <p
      data-slot="form-description"
      id={Silian_formDescriptionId}
      className={Silian_cn("text-muted-foreground text-sm", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_FormMessage({
  className: Silian_className,
  ...Silian_props
}) {
  const { error: Silian_error, formMessageId: Silian_formMessageId } = Silian_useFormField()
  const Silian_body = Silian_error ? String(Silian_error?.message ?? "") : Silian_props.children

  if (!Silian_body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={Silian_formMessageId}
      className={Silian_cn("text-destructive text-sm", Silian_className)}
      {...Silian_props}>
      {Silian_body}
    </p>
  );
}

export {
  Silian_Form as Form,
  Silian_FormItem as FormItem,
  Silian_FormLabel as FormLabel,
  Silian_FormControl as FormControl,
  Silian_FormDescription as FormDescription,
  Silian_FormMessage as FormMessage,
  Silian_FormField as FormField,
}
