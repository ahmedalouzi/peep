# ADR 001: Mobile Preview Rendering Architecture

## Context
The IDE requires a highly accurate, responsive mobile preview pane. We rely on standard Web APIs (React Native Web) hosted locally and displayed inside the IDE. The challenge is rendering a mobile layout (e.g., exactly 393x852) within a fractionally smaller physical pane (e.g., 200x400) while maintaining sharpness and layout accuracy.

## Investigations

We exhaustively investigated three alternative architectures to solve the fractional scaling blur inherent to Chromium compositing:

### 1. WebContentsView + Device Emulation
*   **Approach:** Render the preview in an isolated, native OS view (`WebContentsView`), layered on top of the DOM. Use Chromium's CDP `Emulation.setDeviceMetricsOverride` to decouple the layout dimensions from the physical rasterization scale (replicating Chrome DevTools Device Mode).
*   **Result:** Achieved Xcode-level native sharpness.
*   **Why it was rejected:** 
    *   **Z-Index Failure:** The native view sits completely outside the DOM. Any React-based modals, context menus, tooltips, or command palettes that overlap the preview are physically hidden beneath it.
    *   **Focus Loss:** Clicking the preview transfers OS-level keyboard focus to the guest process, silently breaking global IDE shortcuts (e.g., Cmd+S, Cmd+P).
    *   **IPC Lag:** Fast resizing or scrolling the IDE requires 60fps IPC synchronization, introducing a permanent 1-frame visual lag where the native view detaches from the IDE chassis.

### 2. Scale Quantization (Discrete Snapping)
*   **Approach:** Retain the `<iframe>`, but force the scaling multiplier to snap to specific integer-friendly fractions (e.g., 0.5, 0.75) where 4 logical pixels mathematically map to exactly 1 physical pixel, minimizing bilinear bleeding.
*   **Result:** Noticeable sharpness improvement.
*   **Why it was rejected:** Destroys fluid IDE resizing. The preview box stops resizing smoothly and jumps between fixed sizes, leaving large, ugly margins ("dead space") around the phone chassis as the IDE sidebar is dragged.

### 3. CSS Rendering Hints
*   **Approach:** Apply `transform: translateZ(0)` to force a dedicated compositor layer and `-webkit-font-smoothing: antialiased`.
*   **Result:** Measurable VRAM usage increase with virtually zero perceptible sharpness gain.
*   **Why it was rejected:** Violates the principle of avoiding useless code complexity. The fundamental math of bilinear scaling overrides these hints.

## Decision
**Keep the current `<iframe>` + `transform: scale()` implementation.**

## Rationale
A premium IDE must prioritize flawless User Experience (UX) over theoretical rendering perfection. 

The `<iframe>` architecture comes with a single, known trade-off: slight bilinear blur during fractional downscaling. However, it natively provides:
*   Perfect Z-index overlay compatibility (modals and tooltips work flawlessly).
*   Native keyboard shortcut propagation.
*   Zero IPC sync overhead.
*   Butter-smooth fluid resizing.

The cost of fixing the blur via native views or quantization mathematically breaks the fluidity and usability of the IDE. We accept the blur as a fundamental Chromium limit in exchange for a stable, unified DOM architecture.
