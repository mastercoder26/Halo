import appIcon from "../../app-icon.png";

/**
 * Launch splash — flash the Halo icon, then reveal the wordmark underneath.
 */
export function SplashView() {
  return (
    <div className="halo-splash-root" role="img" aria-label="Halo">
      <div className="halo-splash-stack">
        <div className="halo-splash-plate">
          <img
            className="halo-splash-icon"
            src={appIcon}
            width={112}
            height={112}
            alt=""
            draggable={false}
          />
        </div>
        <span className="halo-splash-word">
          Halo
          <span className="halo-splash-word-mark" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
