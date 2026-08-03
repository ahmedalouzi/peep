import React from 'react';
import { DeviceConfig } from '../../layout/PreviewPane';
import { FrameBackground, FrameForeground } from './PhoneFrame';

interface PreviewAssemblyProps {
  device: DeviceConfig;
  children: React.ReactNode;
}

export function PreviewAssembly({ device, children }: PreviewAssemblyProps) {
  const r = device.screenCutout.cornerRadius;

  return (
    <div className="device-assembly" style={{
      width: `${device.logicalViewport.width}px`,
      height: `${device.logicalViewport.height}px`,
      position: 'relative',
    }}>

      {/* ── Frame Background (Chassis body) ── */}
      <div style={{
        position: 'absolute',
        top: `-${device.screenCutout.y}px`,
        left: `-${device.screenCutout.x}px`,
        width: `${device.logicalViewport.width + device.screenCutout.x * 2}px`,
        height: `${device.logicalViewport.height + device.screenCutout.y * 2}px`,
        pointerEvents: 'none',
      }}>
        <FrameBackground device={device} />
      </div>

      {/* ── Screen Mask — clips content to the screen area ── */}
      {/*   Inner box-shadow creates the "screen inset" bevel effect  */}
      <div className="screen-mask" style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        overflow: 'hidden',
        borderRadius: `${r}px`,
        clipPath: `inset(0 round ${r}px)`,
        /* Subtle inset shadow so screen looks recessed into the chassis */
        boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.65), inset 0 2px 8px rgba(0,0,0,0.5)`,
      }}>
        {children}
      </div>

      {/* ── Visual Overlay (Dynamic Island, status bar, buttons) ── */}
      <div style={{
        position: 'absolute',
        top: `-${device.screenCutout.y}px`,
        left: `-${device.screenCutout.x}px`,
        width: `${device.logicalViewport.width + device.screenCutout.x * 2}px`,
        height: `${device.logicalViewport.height + device.screenCutout.y * 2}px`,
        pointerEvents: 'none',
      }}>
        <FrameForeground device={device} />
      </div>

    </div>
  );
}
