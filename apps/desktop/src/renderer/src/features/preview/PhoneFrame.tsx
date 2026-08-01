import './PhoneFrame.css';
import { useState, useEffect } from 'react';

/** Shows live clock matching the system time */
function useClock() {
  const fmt = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };
  const [time, setTime] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export type DeviceType =
  | 'iphone-15'
  | 'iphone-15-pro'
  | 'iphone-se'
  | 'pixel-8'
  | 'pixel-fold'
  | 'galaxy-s24';

interface PhoneFrameProps {
  device: DeviceType;
  children: React.ReactNode;
}

/** iPhone 15 / 15 Pro — Dynamic Island, titanium frame, rounded corners */
function IPhoneFrame({ pro, children }: { pro?: boolean; children: React.ReactNode }) {
  const time = useClock();
  return (
    <div className={`pf pf-iphone ${pro ? 'pf-iphone--pro' : ''}`}>
      {/* ── Side hardware buttons ── */}
      <div className="pf-btn pf-btn--mute" />
      <div className="pf-btn pf-btn--vol-up" />
      <div className="pf-btn pf-btn--vol-down" />
      <div className="pf-btn pf-btn--power" />

      {/* ── Inner Layering ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        
        {/* 1. Screen clip container (Underlay) */}
        <div className="pf-bezel" style={{ position: 'absolute', inset: 0, background: '#000' }}>
          <div className="pf-screen">
            {children}
          </div>
        </div>

        {/* 2. Bezel overlays (Overlay) */}
        <div className="pf-bezel" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent' }}>
          {/* Status Bar */}
          <div className="pf-status-bar">
            <div className="pf-status-left">
              <span>{time}</span>
            </div>
            <div className="pf-status-right">
              {/* Cellular bars: short-to-tall, left-to-right */}
              <div className="pf-icon-cellular">
                <span/><span/><span/><span/>
              </div>
              {/* WiFi icon */}
              <div className="pf-icon-wifi">
                <svg viewBox="1 8 22 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ width: '16px', height: '12px' }}>
                  <path d="M5 12 A10 10 0 0 1 19 12" />
                  <path d="M8.5 15.5 A5 5 0 0 1 15.5 15.5" />
                  <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </div>
              {/* Battery */}
              <div className="pf-icon-battery">
                <div className="pf-icon-battery-level"></div>
              </div>
            </div>
          </div>

          {/* Dynamic Island */}
          <div className="pf-dynamic-island">
            <div className="pf-di-cam" />
            <div className="pf-di-speaker" />
          </div>

          {/* Home indicator */}
          <div className="pf-home-indicator" />
        </div>
      </div>

      {/* Frame shine overlay */}
      <div className="pf-shine" style={{ pointerEvents: 'none' }} />
    </div>
  );
}

/** iPhone SE — Touch ID button, smaller, classic notch */
function IPhoneSEFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="pf pf-iphone-se">
      <div className="pf-btn pf-btn--vol-up" style={{ top: '90px' }} />
      <div className="pf-btn pf-btn--vol-down" style={{ top: '130px' }} />
      <div className="pf-btn pf-btn--power" style={{ top: '80px' }} />

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* 1. Screen clip container (Underlay) */}
        <div className="pf-bezel" style={{ position: 'absolute', inset: 0, background: '#000' }}>
          <div className="pf-screen">
            {children}
          </div>
        </div>

        {/* 2. Bezel overlays (Overlay) */}
        <div className="pf-bezel" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent' }}>
          {/* SE notch: small FaceTime camera area */}
          <div className="pf-se-topbar">
            <div className="pf-se-speaker" />
            <div className="pf-se-cam" />
          </div>

          {/* SE has physical home button */}
          <div className="pf-se-home-btn">
            <div className="pf-se-home-ring" />
          </div>
        </div>
      </div>

      <div className="pf-shine" style={{ pointerEvents: 'none' }} />
    </div>
  );
}

/** Pixel 8 — Punch-hole camera, flat Android design */
function PixelFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="pf pf-pixel">
      <div className="pf-btn pf-btn--power pf-btn--android-power" />
      <div className="pf-btn pf-btn--vol-up pf-btn--android-vol-up" />
      <div className="pf-btn pf-btn--vol-down pf-btn--android-vol-down" />

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div className="pf-bezel pf-bezel--android" style={{ position: 'absolute', inset: 0, background: '#000' }}>
          <div className="pf-screen">
            {children}
          </div>
        </div>
        
        <div className="pf-bezel pf-bezel--android" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent' }}>
          <div className="pf-screen" style={{ background: 'transparent' }}>
            {/* Punch-hole camera */}
            <div className="pf-punchhole" />
          </div>
          
          {/* Android gesture bar */}
          <div className="pf-android-bar" />
        </div>
      </div>

      <div className="pf-shine pf-shine--android" style={{ pointerEvents: 'none' }} />
    </div>
  );
}

/** Pixel Fold — Foldable design */
function PixelFoldFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="pf pf-pixel-fold">
      <div className="pf-btn pf-btn--power pf-btn--android-power" />
      <div className="pf-btn pf-btn--vol-up pf-btn--android-vol-up" />
      <div className="pf-btn pf-btn--vol-down pf-btn--android-vol-down" />

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div className="pf-bezel pf-bezel--android pf-bezel--fold" style={{ position: 'absolute', inset: 0, background: '#000' }}>
          <div className="pf-screen">
            {children}
          </div>
        </div>
        
        <div className="pf-bezel pf-bezel--android pf-bezel--fold" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent' }}>
          <div className="pf-screen" style={{ background: 'transparent' }}>
            <div className="pf-punchhole pf-punchhole--fold" />
          </div>
          <div className="pf-fold-hinge" />
          <div className="pf-android-bar" />
        </div>
      </div>

      <div className="pf-shine pf-shine--android" style={{ pointerEvents: 'none' }} />
    </div>
  );
}

/** Galaxy S24 — Samsung design, flat sides, small punch-hole */
function GalaxyFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="pf pf-galaxy">
      <div className="pf-btn pf-btn--power pf-btn--samsung-power" />
      <div className="pf-btn pf-btn--vol-up pf-btn--samsung-vol-up" />
      <div className="pf-btn pf-btn--vol-down pf-btn--samsung-vol-down" />

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div className="pf-bezel pf-bezel--android pf-bezel--samsung" style={{ position: 'absolute', inset: 0, background: '#000' }}>
          <div className="pf-screen">
            {children}
          </div>
        </div>
        
        <div className="pf-bezel pf-bezel--android pf-bezel--samsung" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'transparent' }}>
          <div className="pf-screen" style={{ background: 'transparent' }}>
            <div className="pf-punchhole pf-punchhole--samsung" />
          </div>
          <div className="pf-android-bar" />
        </div>
      </div>

      <div className="pf-shine pf-shine--android" style={{ pointerEvents: 'none' }} />
    </div>
  );
}

export function PhoneFrame({ device, children }: PhoneFrameProps) {
  switch (device) {
    case 'iphone-15':     return <IPhoneFrame>{children}</IPhoneFrame>;
    case 'iphone-15-pro': return <IPhoneFrame pro>{children}</IPhoneFrame>;
    case 'iphone-se':     return <IPhoneSEFrame>{children}</IPhoneSEFrame>;
    case 'pixel-8':       return <PixelFrame>{children}</PixelFrame>;
    case 'pixel-fold':    return <PixelFoldFrame>{children}</PixelFoldFrame>;
    case 'galaxy-s24':    return <GalaxyFrame>{children}</GalaxyFrame>;
    default:              return <IPhoneFrame>{children}</IPhoneFrame>;
  }
}
