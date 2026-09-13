import CoreGraphics
import Foundation

/// Tiny helper for Halo hot-zone bypass.
/// Usage: modifier-state bypass-chord
/// Prints "1" when Command+Shift+E are held, otherwise "0".

let kVK_ANSI_E: CGKeyCode = 0x0E

func bypassChordHeld() -> Bool {
  let flags = CGEventSource.flagsState(.hidSystemState)
  let command = flags.contains(.maskCommand)
  let shift = flags.contains(.maskShift)
  let eHeld = CGEventSource.keyState(.hidSystemState, key: kVK_ANSI_E)
  return command && shift && eHeld
}

let args = CommandLine.arguments
guard args.count >= 2 else {
  fputs("usage: modifier-state bypass-chord\n", stderr)
  exit(2)
}

switch args[1] {
case "bypass-chord":
  print(bypassChordHeld() ? "1" : "0")
  exit(0)
default:
  fputs("unknown mode: \(args[1])\n", stderr)
  exit(2)
}
