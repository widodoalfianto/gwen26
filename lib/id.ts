// Per-tab identity so several players can play/test from one browser.
//
// We use sessionStorage (scoped to a single browser TAB) instead of
// localStorage (shared across all tabs). That means each tab is its own
// player — open 4 tabs, get 4 players. Identity survives a refresh in the
// same tab (reconnect still works); it's only lost if you close the tab.
//
// Optional URL overrides for convenience when lining up test players:
//   ?me=<id>     pin a specific player id   (e.g. ?me=gwen)
//   ?as=<name>   prefill the display name   (e.g. ?as=Gwen)

function store(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}
function get(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function set(key: string, value: string) {
  try {
    store()?.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function param(name: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

export function getPlayerId(): string {
  const override = param("me");
  if (override) {
    set("gwen26_pid", override);
    return override;
  }
  let id = get("gwen26_pid");
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "p" + Math.random().toString(36).slice(2);
    set("gwen26_pid", id);
  }
  return id;
}

export function getName(): string {
  return param("as") || get("gwen26_name") || "";
}
export function setName(name: string) {
  set("gwen26_name", name);
}
