import AppKit

let requested = CommandLine.arguments.dropFirst().first
let pattern: NSHapticFeedbackManager.FeedbackPattern =
  requested == "alignment" ? .alignment : .generic

NSHapticFeedbackManager.defaultPerformer.perform(pattern, performanceTime: .now)
