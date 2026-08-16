import { useEffect, useRef, useState } from 'react';

export function PoCPreview() {
  const [active, setActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) {
      (window as any).peep?.pocToggle(false);
      return;
    }

    (window as any).peep?.pocToggle(true);

    let rafId: number;

    const syncBounds = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();

        (window as any).peep?.pocBounds({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          logicalWidth: 393,
          logicalHeight: 852,
          scale: rect.width / 393,
        });
      }
      rafId = requestAnimationFrame(syncBounds);
    };

    syncBounds();

    return () => {
      cancelAnimationFrame(rafId);
      (window as any).peep?.pocToggle(false);
    };
  }, [active]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        background: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: 8,
        padding: 16,
        color: 'white',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: 300,
      }}
    >
      <div style={{ fontWeight: 'bold' }}>Native Preview PoC</div>
      
      <button
        onClick={() => setActive(!active)}
        style={{
          background: active ? '#ef4444' : '#3b82f6',
          color: 'white',
          border: 'none',
          padding: '8px 12px',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        {active ? 'Stop PoC' : 'Start PoC'}
      </button>

      {active && (
        <>
          <div style={{ fontSize: 12, color: '#aaa' }}>
            The red box below is the native view bounds. Resize the IDE window or scroll to test sync.
            Note: React Modals overlapping this area will render *behind* the native view.
          </div>

          <div
            ref={containerRef}
            style={{
              width: '100%',
              aspectRatio: '393 / 852',
              border: '2px dashed #ef4444',
              boxSizing: 'border-box',
              background: 'transparent',
              position: 'relative'
            }}
          >
            {/* The WebContentsView will float perfectly over this div */}
          </div>
        </>
      )}
    </div>
  );
}
