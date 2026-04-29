import { useCallback, useRef, useState } from "react";
import {
  COLLAPSED_W,
  DEFAULT_SIDEBAR_W,
  MAX_SIDEBAR_W,
  MIN_SIDEBAR_W,
} from "../config/layout";

export function useSidebarResize() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_W);
  const isDraggingRef = useRef(false);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newW = Math.max(MIN_SIDEBAR_W, Math.min(MAX_SIDEBAR_W, ev.clientX));
      setSidebarCollapsed(newW <= COLLAPSED_W + 20);
      setSidebarWidth(newW <= COLLAPSED_W + 20 ? COLLAPSED_W : newW);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      if (!prev) {
        setSidebarWidth(COLLAPSED_W);
        return true;
      }

      setSidebarWidth(DEFAULT_SIDEBAR_W);
      return false;
    });
  }, []);

  return {
    sidebarCollapsed,
    sidebarWidth,
    handleDragStart,
    toggleCollapse,
  };
}

