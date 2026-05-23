import * as Silian_React from "react"

import { cn as Silian_cn } from "@/lib/utils"

function Silian_Table({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={Silian_cn("w-full caption-bottom text-sm", Silian_className)}
        {...Silian_props} />
    </div>
  );
}

function Silian_TableHeader({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <thead
      data-slot="table-header"
      className={Silian_cn("[&_tr]:border-b", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_TableBody({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <tbody
      data-slot="table-body"
      className={Silian_cn("[&_tr:last-child]:border-0", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_TableFooter({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <tfoot
      data-slot="table-footer"
      className={Silian_cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", Silian_className)}
      {...Silian_props} />
  );
}

function Silian_TableRow({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <tr
      data-slot="table-row"
      className={Silian_cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_TableHead({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <th
      data-slot="table-head"
      className={Silian_cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_TableCell({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <td
      data-slot="table-cell"
      className={Silian_cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        Silian_className
      )}
      {...Silian_props} />
  );
}

function Silian_TableCaption({
  className: Silian_className,
  ...Silian_props
}) {
  return (
    <caption
      data-slot="table-caption"
      className={Silian_cn("text-muted-foreground mt-4 text-sm", Silian_className)}
      {...Silian_props} />
  );
}

export {
  Silian_Table as Table,
  Silian_TableHeader as TableHeader,
  Silian_TableBody as TableBody,
  Silian_TableFooter as TableFooter,
  Silian_TableHead as TableHead,
  Silian_TableRow as TableRow,
  Silian_TableCell as TableCell,
  Silian_TableCaption as TableCaption,
}
