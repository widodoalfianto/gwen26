// Small helpers for persisting the player's id and display name locally.

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getPlayerId(): string {
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
  return get("gwen26_name") || "";
}
export function setName(name: string) {
  set("gwen26_name", name);
}
