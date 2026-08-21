const SESSION_KEY = "zofranca-demo-session";

const DEFAULT_SESSION = Object.freeze({
  nombre: "María González",
  rol: "Analista de solicitudes",
  iniciales: "MG",
});

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("No fue posible recuperar la sesión académica:", error);
    return null;
  }
}

export function saveSession(session) {
  const name = String(session.nombre || "").trim();
  const role = String(session.rol || "").trim();
  if (!name || !role) throw new Error("El nombre y el rol son obligatorios.");
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const value = { nombre: name, rol: role, iniciales: initials || "US" };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  return value;
}

export function ensureSession() {
  return getSession() || saveSession(DEFAULT_SESSION);
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

