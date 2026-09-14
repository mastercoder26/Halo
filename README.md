# Halo
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/2f8704f5-7b72-459d-9c0b-0c5804babd70" />
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/3cd0ce59-d2b2-4c79-be3c-8d48aea0e3eb" />


Halo is a standalone macOS menu-bar utility that turns screen corners and edges into polished system controls.

Move the pointer into a configured hot zone to control volume, display brightness, appearance, keyboard backlight, mute, keep-awake mode, media playback, a focus timer, or the Quick Dock. Corner controls use Halo's radial dial; edge controls use the compact edge interface.

On first launch, Halo walks through Accessibility access, tests the available system controls, and introduces the configured hot zones. The walkthrough can be rerun from Settings or the menu-bar menu.

Settings includes per-display hot-zone mapping, Quick Dock app selection, feedback preferences, focus-timer durations, launch-at-login, and import/export. Media controls work with Apple Music and Spotify.

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
- Halo has its own bundle identifier and does not require a host app or external runtime.
