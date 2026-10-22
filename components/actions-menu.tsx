"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { FormState } from "@/app/actions";
import { PixelIcon } from "@/components/pixel-icon";

// One thing the menu can do: a server action already bound to its row id,
// e.g. { label: "Delete caption", action: deleteCaption.bind(null, id), … }.
export type MenuAction = {
  label: string;
  confirmText: string;
  action: () => Promise<FormState>;
};

// A gear button that opens a small menu of actions (instead of a row of
// separate trash links). Each action still asks for confirmation first.
// Renders nothing when there's nothing the user is allowed to do.
export function ActionsMenu({ items, label = "Delete options" }: { items: MenuAction[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // While open: focus the first item, close on Escape or a click elsewhere,
  // and let the arrow keys move between items.
  useEffect(() => {
    if (!open) return;
    const menuItems = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    menuItems()[0]?.focus();

    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const list = menuItems();
        const i = list.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        list[(next + list.length) % list.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!items.length) return null;

  function run(item: MenuAction) {
    setOpen(false);
    if (!confirm(item.confirmText)) return;
    startTransition(async () => {
      const result = await item.action();
      if (result?.error) alert(result.error);
    });
  }

  return (
    <div ref={root} className="relative inline-flex items-center gap-2">
      {pending && <span className="text-sm text-dim">Deleting…</span>}
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className={`btn-secondary size-9 disabled:opacity-50 ${open ? "tab-on" : ""}`}
      >
        <PixelIcon name="gear" size={18} />
      </button>
      {open && (
        // Opens upwards: cards clip anything below their bottom edge
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="panel absolute right-0 bottom-full mb-2 z-20 min-w-44 py-1 flex flex-col"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => run(item)}
              className="px-3 py-2 text-left text-sm text-ink whitespace-nowrap hover:bg-well hover:text-danger focus-visible:bg-well cursor-pointer"
            >
              <PixelIcon name="trash" size={14} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
