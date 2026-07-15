import './PhoneFrame.css';

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
  return (
    <div className={`pf pf-iphone ${pro ? 'pf-iphone--pro' : ''}`}>
      {/* ── Side hardware buttons ── */}
      <div className="pf-btn pf-btn--mute" />
      <div className="pf-btn pf-btn--vol-up" />
      <div className="pf-btn pf-btn--vol-down" />
      <div className="pf-btn pf-btn--power" />

      {/* ── Screen bezel ── */}
      <div className="pf-bezel">
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
