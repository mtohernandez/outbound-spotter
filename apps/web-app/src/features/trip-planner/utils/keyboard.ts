// True if the event is a system shortcut (Ctrl/Meta/Alt) rather than a plain
// keypress — used by the map's R-key recenter handler so we don't intercept
// Cmd+R / Ctrl+R browser reload, Alt-R menu mnemonics, etc.
export function isModifierKey(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey;
}
