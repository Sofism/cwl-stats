// Integracion minima con la API REST de cron-job.org (docs.cron-job.org)
// para programar UNA comprobacion puntual justo despues de que termine una
// guerra normal, en vez de depender solo de la cadencia fija del cron
// externo. Se usa unicamente para acortar la ventana de riesgo descrita en
// api/sync.js (la API de Clash solo expone la guerra actual: si el estado
// warEnded se escapa entre dos ejecuciones del cron, esa guerra se pierde
// o se rescata incompleta).
//
// Requiere la variable de entorno CRONJOB_API_KEY (Console -> Settings ->
// API en cron-job.org). Si no esta configurada, estas funciones no hacen
// nada (devuelven null) y el resto de api/sync.js sigue funcionando igual
// que antes, solo sin el anclaje preciso.
const API_BASE = "https://api.cron-job.org";

const apiFetch = (path, options = {}) => {
  const apiKey = process.env.CRONJOB_API_KEY;
  if (!apiKey) return null;
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });
};

/**
 * Las fechas de la API de Clash vienen como "20260829T120000.000Z", que
 * Date no parsea directamente. Mismo criterio que el helper ya duplicado
 * en varios componentes del cliente (CurrentWarView.jsx, SeasonSelector.jsx).
 */
const parseApiDate = (raw) => {
  if (!raw) return null;
  const iso = raw.replace(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/,
    "$1-$2-$3T$4:$5:$6"
  );
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Programa UNA comprobacion puntual en cron-job.org que llama a `url` en
 * el instante `when` (se usa su hora UTC). La API de cron-job.org no tiene
 * un modo "una sola vez" explicito: se consigue fijando minuto/hora/dia/mes
 * EXACTOS en vez de comodines ([-1]), asi que solo coincide esa fecha
 * concreta (volveria a coincidir dentro de un año si no se borra, algo
 * inofensivo dado que a esas alturas ya no habra ninguna guerra que
 * rescatar con ese warKey).
 *
 * Devuelve el jobId creado, o null si no hay CRONJOB_API_KEY configurada o
 * si la llamada falla (best-effort: si falla, el cron habitual sigue
 * siendo la red de seguridad).
 */
const scheduleOneTimeCheck = async (url, when) => {
  try {
    const res = await apiFetch("/jobs", {
      method: "PUT",
      body: JSON.stringify({
        job: {
          url,
          enabled: true,
          schedule: {
            timezone: "UTC",
            expiresAt: 0,
            minutes: [when.getUTCMinutes()],
            hours: [when.getUTCHours()],
            mdays: [when.getUTCDate()],
            months: [when.getUTCMonth() + 1],
            wdays: [-1],
          },
        },
      }),
    });
    if (!res || !res.ok) return null;
    const data = await res.json();
    return data.jobId ?? null;
  } catch {
    return null;
  }
};

/** Borra el job puntual una vez que ya ha cumplido su funcion. Best-effort. */
const deleteScheduledJob = async (jobId) => {
  if (!jobId) return;
  try {
    await apiFetch(`/jobs/${jobId}`, { method: "DELETE" });
  } catch {
    // Si falla el borrado no pasa nada grave: es un disparo puntual, como
    // mucho volveria a saltar dentro de un año y encontraria "no-war".
  }
};

module.exports = { parseApiDate, scheduleOneTimeCheck, deleteScheduledJob };
