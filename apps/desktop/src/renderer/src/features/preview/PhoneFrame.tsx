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

      {/* ── Screen bezel ── */}
      <div className="pf-bezel">
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

        {/* Screen */}
        <div className="pf-screen">
          {children}
        </div>

        {/* Home indicator */}
        <div className="pf-home-indicator" />
      </div>

      {/* Frame shine overlay */}
      <div className="pf-shine" />
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

      <div className="pf-bezel">
        {/* SE notch: small FaceTime camera area */}
        <div className="pf-se-topbar">
          <div className="pf-se-speaker" />
          <div className="pf-se-cam" />
        </div>

        <div className="pf-screen">
          {children}
        </div>

        {/* SE has physical home button */}
        <div className="pf-se-home-btn">
          <div className="pf-se-home-ring" />
        </div>
      </div>

      <div className="pf-shine" />
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

      <div className="pf-bezel pf-bezel--android">
        <div className="pf-screen">
          {/* Punch-hole camera */}
          <div className="pf-punchhole" />
          {children}
        </div>
        {/* Android gesture bar */}
        <div className="pf-android-bar" />
      </div>

      <div className="pf-shine pf-shine--android" />
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

      <div className="pf-bezel pf-bezel--android pf-bezel--fold">
        <div className="pf-screen">
          <div className="pf-punchhole pf-punchhole--fold" />
          {children}
        </div>
        <div className="pf-fold-hinge" />
        <div className="pf-android-bar" />
      </div>

      <div className="pf-shine pf-shine--android" />
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

      <div className="pf-bezel pf-bezel--android pf-bezel--samsung">
        <div className="pf-screen">
          <div className="pf-punchhole pf-punchhole--samsung" />
          {children}
        </div>
        <div className="pf-android-bar" />
      </div>

      <div className="pf-shine pf-shine--android" />
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
