import React, { useEffect, useRef } from "react";

/**
 * CursorFollowGlow
 * High-performance, subtle ambient glow tracking cursor movement on desktop.
 * - Smooth linear interpolation (lerp) through requestAnimationFrame.
 * - Updates direct CSS variables on DOM (0 React re-renders).
 * - pointer-events: none ensures zero interference with clickable elements.
 * - Disabled automatically on touch devices and reduced-motion preferences.
 */
export default function CursorFollowGlow({
  className = "",
  style = {},
  radius = 600,
  opacity = 0.85,
}) {
  const containerRef = useRef(null);

  useEffect(() => {
    // Only run on fine-pointer devices without reduced motion
    const isFinePointer =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const isReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!isFinePointer || isReducedMotion) return;

    const el = containerRef.current;
    if (!el) return;

    let rafId = null;
    let targetX = -1000;
    let targetY = -1000;
    let currentX = -1000;
    let currentY = -1000;
    let isInside = false;

    const parent = el.parentElement || el;

    const handlePointerMove = (e) => {
      const rect = parent.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if pointer is within or close to parent bounds
      if (
        x >= -100 &&
        x <= rect.width + 100 &&
        y >= -100 &&
        y <= rect.height + 100
      ) {
        targetX = x;
        targetY = y;
        isInside = true;

        if (currentX === -1000) {
          currentX = targetX;
          currentY = targetY;
        }

        if (!rafId) {
          rafId = requestAnimationFrame(updateGlow);
        }
      } else {
        isInside = false;
      }
    };

    const handlePointerLeave = () => {
      isInside = false;
    };

    const updateGlow = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      el.style.setProperty("--cursor-x", `${currentX.toFixed(1)}px`);
      el.style.setProperty("--cursor-y", `${currentY.toFixed(1)}px`);
      el.style.opacity = isInside ? String(opacity) : "0";

      if (
        isInside &&
        (Math.abs(targetX - currentX) > 0.4 || Math.abs(targetY - currentY) > 0.4)
      ) {
        rafId = requestAnimationFrame(updateGlow);
      } else {
        rafId = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", handlePointerLeave);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [opacity]);

  return (
    <div
      ref={containerRef}
      className={`cursor-follow-glow-layer ${className}`}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
        borderRadius: "inherit",
        opacity: 0,
        transition: "opacity 0.4s ease",
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

