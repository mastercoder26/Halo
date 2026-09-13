import Foundation
import CoreGraphics

typealias DSGet = @convention(c) (CGDirectDisplayID, UnsafeMutablePointer<Float>) -> Int32
typealias DSSet = @convention(c) (CGDirectDisplayID, Float) -> Int32
typealias DSCan = @convention(c) (CGDirectDisplayID) -> Bool

let handle = dlopen("/System/Library/PrivateFrameworks/DisplayServices.framework/DisplayServices", RTLD_NOW)
guard handle != nil else {
  fputs("error: DisplayServices unavailable\n", stderr)
  exit(1)
}

func load<T>(_ name: String) -> T? {
  guard let sym = dlsym(handle, name) else { return nil }
  return unsafeBitCast(sym, to: T.self)
}

guard let getBr: DSGet = load("DisplayServicesGetBrightness"),
      let setBr: DSSet = load("DisplayServicesSetBrightness") else {
  fputs("error: DisplayServices symbols missing\n", stderr)
  exit(2)
}
let canBr: DSCan? = load("DisplayServicesCanChangeBrightness")

func activeDisplays() -> [CGDirectDisplayID] {
  var count: UInt32 = 0
  CGGetActiveDisplayList(0, nil, &count)
  var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
  CGGetActiveDisplayList(count, &ids, &count)
  return Array(ids.prefix(Int(count)))
}

func readBrightness(_ id: CGDirectDisplayID) -> Float? {
  var br: Float = 0
  let err = getBr(id, &br)
  return err == 0 ? br : nil
}

func writeBrightness(_ id: CGDirectDisplayID, _ value: Float) -> Float? {
  let clamped = max(0, min(1, value))
  if let can = canBr, !can(id) { return nil }
  let err = setBr(id, clamped)
  guard err == 0 else { return nil }
  return readBrightness(id) ?? clamped
}

let args = CommandLine.arguments
let cmd = args.count > 1 ? args[1] : "get"
let displays = activeDisplays()
guard !displays.isEmpty else {
  fputs("error: no displays\n", stderr)
  exit(3)
}

switch cmd {
case "get":
  let id: CGDirectDisplayID = {
    if args.count > 2, let n = UInt32(args[2]) { return n }
    return CGMainDisplayID()
  }()
  // Prefer requested id; fall back to main / first readable
  let candidates = [id, CGMainDisplayID()] + displays
  for candidate in candidates {
    if let br = readBrightness(candidate) {
      let pct = Int((br * 100.0).rounded())
      print(pct)
      exit(0)
    }
  }
  fputs("error: read failed\n", stderr)
  exit(4)

case "set":
  guard args.count > 2, let pct = Float(args[2]) else {
    fputs("usage: brightness set <0-100> [displayId]\n", stderr)
    exit(5)
  }
  let target = max(0, min(100, pct)) / 100.0
  let id: CGDirectDisplayID = {
    if args.count > 3, let n = UInt32(args[3]) { return n }
    return CGMainDisplayID()
  }()
  let candidates = [id, CGMainDisplayID()] + displays
  for candidate in candidates {
    if let after = writeBrightness(candidate, target) {
      print(Int((after * 100.0).rounded()))
      exit(0)
    }
  }
  fputs("error: set failed\n", stderr)
  exit(6)

case "list":
  for id in displays {
    let can = canBr?(id) ?? false
    let br = readBrightness(id).map { String(format: "%.4f", $0) } ?? "na"
    print("\(id)\tcan=\(can)\tbrightness=\(br)")
  }

default:
  fputs("usage: brightness get|set|list\n", stderr)
  exit(7)
}
