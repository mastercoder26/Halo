# Halo

Halo is a standalone Electron macOS utility for simple cursor-edge system controls.

On first launch, Halo walks through Accessibility access and its default corner controls. You can rerun setup from the app menu or menu bar at any time.

Use **Now Playing** from the app or menu bar to control playback in Apple Music. You can also assign **Now playing** to any hot zone for quick play/pause.

## Requirements

- macOS
- Node.js 24 or newer
- npm
- Python 3, used only to regenerate the app icon
- Xcode command line tools, used to build the small Swift native helpers

## Run Locally

Install dependencies:

```sh
npm install
```

Start the development app:

```sh
npm run dev
```

Build the runtime output:

```sh
npm run build
```

Create an unpacked macOS app:

```sh
npm run package:dir
open release/mac-arm64/Halo.app
```

Create distributable macOS artifacts:

```sh
npm run package
```

## Verification

```sh
npm run type-check
npm test
npm run lint
```

## Notes

- The app runs on its own Electron runtime.
- Renderer code talks to the main process through `window.haloAPI`, defined in `renderer/preload.ts`.
- Native macOS access is isolated behind `main/platform/electron.ts`.
