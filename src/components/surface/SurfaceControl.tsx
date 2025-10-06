"use client";

import { PropsWithChildren, useEffect, useState, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import styles from "./surface-control.module.css";

/** Expose DOM nodes for named slots (optional API) */
type SurfaceSlots = {
  topbar: HTMLElement | null;
  menus: HTMLElement | null;
  toasts: HTMLElement | null;
  dialogs: HTMLElement | null;
};
const SurfaceContext = createContext<SurfaceSlots | null>(null);
export const useSurface = () => useContext(SurfaceContext)!;

export default function SurfaceControl({ children, className }: PropsWithChildren<{ className?: string }>) {
  const [mounted, setMounted] = useState(false);
  const [slots, setSlots] = useState<SurfaceSlots>({ topbar: null, menus: null, toasts: null, dialogs: null });
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    setSlots({
      topbar: document.getElementById("surface-slot-topbar"),
      menus: document.getElementById("surface-slot-menus"),
      toasts: document.getElementById("surface-slot-toasts"),
      dialogs: document.getElementById("surface-slot-dialogs")
    });
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <SurfaceContext.Provider value={slots}>
      <div id="application-layers" className={styles.layers}>
        {/* bypass block (skip nav) */}
        <div id="bypass-block-wrapper" className={styles.bypass}>
          <button className={styles.skipBtn} onClick={() => document.getElementById("main-content")?.focus()}>
            Skip to content
          </button>
        </div>

        {/* surface / control */}
        <div id="surface" className={styles.surface}>
          <div id="surface-control" className={clsx(styles.surfaceControl, className)}>
            <div id="surface-slot-topbar" className={styles.topbarRow} />
          </div>
          {/* Optional content layer (kept empty like monday’s #surface-content) */}
          <div id="surface-content" className={styles.surfaceContent} />
        </div>

        {/* Global portals (menus, toasts, dialogs) */}
        <div id="surface-slot-menus" className={styles.absSlot} />
        <div id="surface-slot-toasts" className={styles.absSlot} />
        <div id="surface-slot-dialogs" className={styles.absSlot} />
      </div>

      {children /* your normal app below the overlay */}
    </SurfaceContext.Provider>,
    document.body
  );
}
