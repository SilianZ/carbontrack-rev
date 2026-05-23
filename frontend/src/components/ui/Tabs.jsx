import Silian_React, { useState as Silian_useState } from 'react';

export function Tabs({ children: Silian_children, value: Silian_value, onValueChange: Silian_onValueChange, className: Silian_className = '' }) {
  const [Silian_internal, Silian_setInternal] = Silian_useState(Silian_value || '');
  const Silian_active = Silian_value !== undefined ? Silian_value : Silian_internal;
  const Silian_setActive = (Silian_v) => {
    if (Silian_onValueChange) Silian_onValueChange(Silian_v);
    if (Silian_value === undefined) Silian_setInternal(Silian_v);
  };

  return (
    <div className={Silian_className} data-tabs>
      {Silian_React.Children.map(Silian_children, (Silian_child) => {
        if (!Silian_React.isValidElement(Silian_child)) return Silian_child;
        if (Silian_child.type === TabsList) {
          return Silian_React.cloneElement(Silian_child, { active: Silian_active, setActive: Silian_setActive });
        }
        if (Silian_child.type === TabsContent) {
          return Silian_React.cloneElement(Silian_child, { active: Silian_active });
        }
        return Silian_child;
      })}
    </div>
  );
}

export function TabsList({ children: Silian_children, active: Silian_active, setActive: Silian_setActive, className: Silian_className = '' }) {
  return (
    <div className={`inline-flex rounded-md border border-border bg-card ${Silian_className}`} role="tablist">
      {Silian_React.Children.map(Silian_children, (Silian_child) => {
        if (!Silian_React.isValidElement(Silian_child)) return Silian_child;
        return Silian_React.cloneElement(Silian_child, { active: Silian_active, setActive: Silian_setActive });
      })}
    </div>
  );
}

export function TabsTrigger({ value: Silian_value, children: Silian_children, active: Silian_active, setActive: Silian_setActive, className: Silian_className = '' }) {
  const Silian_isActive = Silian_active === Silian_value;
  return (
    <button
      role="tab"
      aria-selected={Silian_isActive}
      onClick={() => Silian_setActive(Silian_value)}
      className={`border-r border-border px-3 py-2 text-sm text-foreground last:border-r-0 ${Silian_isActive ? 'bg-muted font-semibold' : 'hover:bg-muted/60'} ${Silian_className}`}
    >
      {Silian_children}
    </button>
  );
}

export function TabsContent({ value: Silian_value, active: Silian_active, children: Silian_children, className: Silian_className = '' }) {
  if (Silian_active !== Silian_value) return null;
  return (
    <div role="tabpanel" className={Silian_className}>
      {Silian_children}
    </div>
  );
}
