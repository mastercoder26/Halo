import { useEffect, useState } from "react";

interface AppIconProps {
  appPath: string;
  alt?: string;
  className?: string;
  size: number;
}

function nativeIconSize(size: number): 16 | 32 | 64 {
  return size <= 16 ? 16 : size <= 32 ? 32 : 64;
}

export function AppIcon({ appPath, alt = "", className = "", size }: AppIconProps) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;
    setSource("");
    void window.haloAPI.files
      .iconDataUrl(appPath, nativeIconSize(size))
      .then((next) => {
        if (active && next) setSource(next);
      })
      .catch(() => {
        // Preserve the app row when an application has no readable icon.
      });
    return () => {
      active = false;
    };
  }, [appPath, size]);

  if (!source) {
    return (
      <span
        aria-hidden="true"
        className={`halo-app-icon-placeholder ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={source}
      alt={alt}
      width={size}
      height={size}
      className={className}
      draggable={false}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}
