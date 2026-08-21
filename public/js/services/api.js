import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../config.js";

export class ApiError extends Error {
  constructor(message, status = 0, cause = null) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
  }
}

function buildUrl(resource, id = "") {
  const cleanResource = String(resource).replace(/^\/+|\/+$/g, "");
  const cleanId = id === "" || id === null ? "" : `/${encodeURIComponent(id)}`;
  return `${API_BASE_URL}/${cleanResource}${cleanId}`;
}

function messageForStatus(status) {
  if (status === 404) return "No se encontró la información solicitada.";
  if (status === 409) return "La información entra en conflicto con un registro existente.";
  if (status >= 500) return "El servidor no pudo completar la operación.";
  return "No fue posible completar la operación.";
}

async function request(resource, { id = "", method = "GET", body } = {}) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(resource, id), {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = response.status === 204 ? "" : await response.text();
    let data = null;

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (error) {
        throw new ApiError("El servidor devolvió una respuesta inválida.", response.status, error);
      }
    }

    if (!response.ok) {
      throw new ApiError(data?.message || messageForStatus(response.status), response.status);
    }

    return data;
  } catch (error) {
    console.error("[ZoFranca CR] Error de comunicación:", error);

    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") {
      throw new ApiError("La operación tardó demasiado. Intente nuevamente.", 408, error);
    }
    throw new ApiError(
      "No se pudo conectar con el backend. Verifique que json-server esté activo en http://localhost:3001.",
      0,
      error,
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export const api = Object.freeze({
  list(resource) {
    return request(resource);
  },
  get(resource, id) {
    return request(resource, { id });
  },
  create(resource, body) {
    return request(resource, { method: "POST", body });
  },
  replace(resource, id, body) {
    return request(resource, { id, method: "PUT", body });
  },
  patch(resource, id, body) {
    return request(resource, { id, method: "PATCH", body });
  },
  remove(resource, id) {
    return request(resource, { id, method: "DELETE" });
  },
});

