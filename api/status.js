const redis = require('./redis');
const { normalizeTag, getClanInfo, proxyGet } = require('./_lib/cocProxy');
const { listJobs, selfTest, renameJob } = require('./_lib/cronJobOrg');

/**
 * Pagina de diagnostico: dice en lenguaje llano si todo lo que necesita la
 * app esta bien configurado, sin tener que mirar paneles ni logs.
 *
 *   /api/status?secret=<CRON_SECRET>            comprobacion rapida (solo lectura)
 *   /api/status?secret=<CRON_SECRET>&test=1     ademas prueba el anclaje de cron-job.org
 *                                               (crea y borra un trabajo desactivado)
 *
 * Nunca devuelve claves ni URLs con claves: solo si estan puestas o no.
 */
const readJson = async (key, fallback) => {
  const data = await redis.get(key);
  if (!data) return fallback;
  return typeof data === 'string' ? JSON.parse(data) : data;
};

const ago = (ms) => {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};


const pad = (n) => String(n).padStart(2, '0');

/** Horario de un trabajo de cron-job.org en lenguaje llano. */
const describeSchedule = (sch) => {
  if (!sch) return { kind: 'unknown', text: 'unknown schedule' };
  const any = (a) => !a || a.length === 0 || (a.length === 1 && a[0] === -1);
  const mins = sch.minutes || [];
  if (!any(sch.mdays) && !any(sch.months)) {
    return { kind: 'one-time', text: `once, ${pad(sch.mdays[0])}/${pad(sch.months[0])} at ${pad((sch.hours || [0])[0])}:${pad(mins[0] || 0)} UTC` };
  }
  if (any(sch.hours)) {
    if (mins.length === 1) return { kind: 'recurring', text: `every hour at :${pad(mins[0])}` };
    const step = mins.length > 1 ? mins[1] - mins[0] : null;
    const even = step && mins.every((m, i) => m === mins[0] + i * step);
    return { kind: 'recurring', text: even && 60 % step === 0 ? `every ${step} minutes` : `every hour at minutes ${mins.join(', ')}` };
  }
  return { kind: 'recurring', text: `at hours ${(sch.hours || []).join(', ')} UTC, minute ${mins.join(', ')}` };
};

/** Que es cada trabajo: clan (por la URL), tipo, horario, estado y titulo sugerido. */
const describeJobs = (jobs, purposeById) =>
  jobs.map((j) => {
    const clanMatch = /[?&]clan=(main|secondary)/.exec(String(j.url || ''));
    const clan = clanMatch ? clanMatch[1] : 'both';
    const sch = describeSchedule(j.schedule);
    const purpose =
      sch.kind === 'one-time'
        ? purposeById.get(Number(j.jobId)) || 'one-time check (could not match it to a war)'
        : `regular sync of the ${clan === 'main' ? 'main clan (normal wars + CWL)' : clan === 'secondary' ? 'secondary clan (CWL only)' : 'both clans'}`;
    return {
      id: j.jobId,
      title: j.title || '',
      clan,
      kind: sch.kind,
      schedule: sch.text,
      purpose,
      enabled: !!j.enabled,
      lastStatus: j.lastStatus,
      nextRun: j.nextExecution ? new Date(j.nextExecution * 1000).toISOString() : null,
      suggestedTitle: `cwl-stats · ${clan} · ${sch.kind === 'recurring' ? `sync ${sch.text}` : purpose}`,
    };
  });

const summarizeJob = (j) =>
  `#${j.id} [${j.enabled ? 'on' : 'OFF'}] ${j.clan} · ${j.schedule} → ${j.purpose}` +
  `${j.title ? ` (title: "${j.title}")` : ' (no title)'}${j.nextRun ? ` · next: ${j.nextRun.slice(0, 16).replace('T', ' ')} UTC` : ''}${j.labeled ? ` · ${j.labeled}` : ''}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const secret = (req.query && req.query.secret) || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Cada comprobacion: level "required" (si falla, algo no funciona) o
  // "optional" (mejora, pero la app va sin ello).
  const checks = [];
  const add = (name, ok, detail, level = 'required', fix) =>
    checks.push({ name, ok, level, detail, ...(ok || !fix ? {} : { fix }) });

  try {
    const env = process.env;

    // 1) Variables de entorno
    add('CRON_SECRET', true, 'set (you are using it right now)');
    add('REACT_APP_COC_PROXY_URL', !!env.REACT_APP_COC_PROXY_URL,
      env.REACT_APP_COC_PROXY_URL ? 'set' : 'missing', 'required',
      'Add it in Vercel (Settings > Environment Variables) and redeploy.');
    const redisKind =
      env.KV_REST_API_URL && env.KV_REST_API_TOKEN
        ? 'Vercel KV'
        : env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? 'Upstash'
        : null;
    add('Redis variables', !!redisKind, redisKind ? `using ${redisKind}` : 'missing', 'required');
    add('CRONJOB_API_KEY', !!env.CRONJOB_API_KEY,
      env.CRONJOB_API_KEY ? 'set' : 'missing',
      'required', 'Create the key in cron-job.org (Settings > API), add it in Vercel for Production and redeploy.');
    add('WRITE_SECRET / REACT_APP_WRITE_SECRET', !!env.WRITE_SECRET === !!env.REACT_APP_WRITE_SECRET,
      env.WRITE_SECRET && env.REACT_APP_WRITE_SECRET
        ? 'both set (writes are protected)'
        : !env.WRITE_SECRET && !env.REACT_APP_WRITE_SECRET
        ? 'not set (writes are open - optional protection)'
        : 'ONLY ONE of the two is set: the app cannot save',
      'optional', 'Set both with the same value, or neither.');
    add('REACT_APP_COC_PROXY_SECRET', !!env.REACT_APP_COC_PROXY_SECRET,
      env.REACT_APP_COC_PROXY_SECRET ? 'set' : 'not set (the proxy accepts anyone who knows its URL)',
      'optional', 'Set PROXY_SECRET in Render and the same value as REACT_APP_COC_PROXY_SECRET in Vercel.');

    // 2) Redis responde
    try {
      await redis.set('status-ping', String(Date.now()), { ex: 60 });
      const back = await redis.get('status-ping');
      add('Redis connection', !!back, back ? 'read and write OK' : 'wrote but could not read back');
    } catch (err) {
      add('Redis connection', false, `error: ${err.message}`);
    }

    // 3) Clanes configurados
    const config = await readJson('cwl-clan-config', null);
    add('Clan tags saved', !!(config && config.mainTag), config && config.mainTag ? `${config.main || ''} ${config.mainTag}`.trim() : 'no clan configured',
      'required', 'Open the app > Settings and save the clan tags.');

    // 4) Proxy de Clash
    if (config && config.mainTag) {
      try {
        const info = await getClanInfo(config.mainTag);
        add('Clash API through the proxy', !!info, info ? `OK (${info.name})` : 'the proxy or Clash did not answer correctly',
          'required', 'Check the Render service (it may be asleep or down) and the Clash API token / IP whitelist.');
        const war = await proxyGet(`clans/${encodeURIComponent(normalizeTag(config.mainTag))}/currentwar`);
        add('War log readable', war.ok,
          war.ok ? `OK (state: ${war.data && war.data.state})` : `HTTP ${war.status} ${(war.data && war.data.reason) || ''}`.trim(),
          'required', 'If it says accessDenied, make the clan war log PUBLIC in the game.');
      } catch (err) {
        add('Clash API through the proxy', false, `error: ${err.message}`);
      }
    }

    // 5) cron-job.org
    if (env.CRONJOB_API_KEY) {
      const jobs = await listJobs();
      if (jobs.error) {
        add('cron-job.org API', false, jobs.error, 'required', 'The key is probably wrong or revoked: create a new one and update Vercel.');
      } else {
        const syncJobs = jobs.jobs.filter((j) => String(j.url || '').includes('/api/sync'));
        const recurring = syncJobs.filter((j) => j.enabled);
        const disabled = syncJobs.filter((j) => !j.enabled);
        add('cron-job.org API', true, `key works; ${jobs.jobs.length} jobs in the account, ${syncJobs.length} point at this app`);
        add('Hourly sync jobs enabled', recurring.length > 0 && disabled.length === 0,
          `${recurring.length} enabled${disabled.length ? `, ${disabled.length} DISABLED` : ''}`,
          'required', 'Enable them in cron-job.org (it disables jobs after repeated failures).');
        const failing = recurring.filter((j) => j.lastStatus !== undefined && j.lastStatus !== 1 && j.lastStatus !== 0);
        if (recurring.length) {
          add('Last runs of those jobs', failing.length === 0,
            failing.length ? `${failing.length} failed their last run (see History in cron-job.org)` : 'last run OK',
            'required', 'Open the job in cron-job.org > History to see the error code.');
        }
      }
      if (req.query && req.query.test) {
        const host = req.headers.host ? `https://${req.headers.host}` : 'https://example.com';
        const t = await selfTest(`${host}/api/status?ping=1`);
        add('Anchoring self-test', t.ok, t.steps.join(' -> '), 'required',
          'The key can read jobs but not create/delete them: check its permissions in cron-job.org.');
      }
    }

    // 6) Ultima sincronizacion y guerra en seguimiento
    if (config && config.mainTag) {
      const tag = normalizeTag(config.mainTag);
      const last = await readJson(`sync-status:${tag}`, null);
      if (!last) {
        add('Last sync', false, 'never ran', 'required', 'Check that the cron-job.org jobs exist and call /api/sync?clan=main&secret=...');
      } else {
        const fresh = Date.now() - last.at < 90 * 60 * 1000;
        add('Last sync', fresh && last.status !== 'error',
          `${ago(last.at)} - ${last.status}${last.error ? ` (${last.error})` : ''}; CWL: ${last.cwl || '-'}${last.cwlError ? ` (${last.cwlError})` : ''}`,
          'required', fresh ? 'See the error above.' : 'Older than 90 minutes: the cron is not running.');
      }
      const progress = await readJson(`normal-wars-progress:${tag}`, null);
      if (progress && progress.lastWar) {
        const anchored = !!(progress.scheduledFollowUp || progress.scheduledPreEnd);
        add('War being tracked', true, `state ${progress.lastSeenState}, ends ${progress.lastWar.endTime || '?'}`);
        if (env.CRONJOB_API_KEY) {
          add('Extra checks scheduled for this war', anchored,
            anchored
              ? `yes (${[progress.scheduledPreEnd && 'before the end', progress.scheduledFollowUp && 'after the end'].filter(Boolean).join(' + ')})`
              : `no${progress.scheduleError ? `: ${progress.scheduleError}` : ''}`,
            'required', 'See the reason above; the next hourly run tries again.');
        }
      } else {
        add('War being tracked', true, 'none right now (not in a war, or between wars)', 'optional');
      }
    }

    // Que es cada trabajo de cron-job.org, en lenguaje llano (sin URLs ni claves).
    // Con &label=1 se ponen titulos a los que no tienen (nunca se pisa uno
    // que hayas puesto tu).
    let jobsReport = null;
    if (env.CRONJOB_API_KEY && config) {
      const listed = await listJobs();
      if (!listed.error) {
        const purposeById = new Map();
        for (const tagKey of ['mainTag', 'secondaryTag']) {
          if (!config[tagKey]) continue;
          const tag = normalizeTag(config[tagKey]);
          const prog = await readJson(`normal-wars-progress:${tag}`, null);
          if (prog && prog.scheduledPreEnd) purposeById.set(Number(prog.scheduledPreEnd.jobId), 'normal war: check 10 min before the end');
          if (prog && prog.scheduledFollowUp) purposeById.set(Number(prog.scheduledFollowUp.jobId), 'normal war: check 5 min after the end');
          const st = await readJson(`cwl-state:${tag}`, null);
          if (st && st.anchors) Object.values(st.anchors).forEach((a) => purposeById.set(Number(a.jobId), 'CWL: check 3 min after a round ends'));
        }
        jobsReport = describeJobs(listed.jobs.filter((j) => String(j.url || '').includes('/api/sync')), purposeById);
        if (req.query && req.query.label) {
          for (const j of jobsReport) {
            // Se renombran los que no tienen titulo o llevan uno generico (job1,
            // job2...). Un titulo puesto a mano que diga algo, no se toca.
            if (j.title && !/^job\s*\d*$/i.test(j.title.trim())) continue;
            const r = await renameJob(j.id, j.suggestedTitle);
            j.labeled = r.ok ? 'renamed to: ' + j.suggestedTitle : 'could not rename (' + r.error + ')';
          }
        }
      }
    }

    // Comprobaciones puntuales de fin de ronda de CWL (solo mientras hay liga).
    if (config && env.CRONJOB_API_KEY) {
      for (const [label, tagKey] of [['main', 'mainTag'], ['secondary', 'secondaryTag']]) {
        if (!config[tagKey]) continue;
        const st = await readJson(`cwl-state:${normalizeTag(config[tagKey])}`, null);
        const n = st && st.anchors ? Object.keys(st.anchors).length : 0;
        if (st && (n > 0 || st.anchorError)) {
          add(`CWL round checks (${label})`, !st.anchorError || n > 0,
            n > 0 ? `${n} scheduled for the open round(s)` : `none scheduled: ${st.anchorError}`,
            'required', 'See the reason above; the next hourly run tries again.');
        }
      }
    }

    const problems = checks.filter((c) => !c.ok && c.level === 'required');
    const warnings = checks.filter((c) => !c.ok && c.level === 'optional');
    return res.status(200).json({
      verdict: problems.length === 0 ? 'ALL GOOD' : `${problems.length} PROBLEM(S) TO FIX`,
      problems: problems.map((c) => `${c.name}: ${c.detail}. ${c.fix || ''}`.trim()),
      optional: warnings.map((c) => `${c.name}: ${c.detail}. ${c.fix || ''}`.trim()),
      checks: checks.map((c) => `${c.ok ? 'OK ' : c.level === 'optional' ? 'TIP' : 'BAD'}  ${c.name}: ${c.detail}`),
      ...(jobsReport ? { cronJobs: jobsReport.map(summarizeJob) } : {}),
    });
  } catch (err) {
    console.error('Status error:', err);
    return res.status(500).json({ error: 'Status check failed', details: err.message });
  }
}
