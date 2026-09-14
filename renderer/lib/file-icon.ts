export function getFileIconUrl(appPath: string, options?: { size?: number }): string {
  const query = new URLSearchParams({
    path: appPath,
    size: String(options?.size ?? 64),
  });
  return `halo-icon://icon?${query.toString()}`;
}
