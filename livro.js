(() => {
  'use strict';

  const ATOS = Array.from({ length: 10 }, (_, i) => {
    const id = i + 1;
    const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][i];
    return {
      id,
      roman,
      titulo: `Ato ${roman}`,
      audio: `livro/audio/ato-${String(id).padStart(2, '0')}.mp3`,
      data: `livro/dados/ato-${String(id).padStart(2, '0')}.json`
    };
  });

  // NÃO mudar este nome entre versões.
  const STORAGE_KEY = 'kaelthera:livro:progresso';

  const $ = (s) => document.querySelector(s);
  const el = {
    audio: $('#bookAudio'), actList: $('#actList'), actNumber: $('#actNumber'),
    actTitle: $('#actTitle'), chapterNow: $('#chapterNow'), bookText: $('#bookText'),
    playPause: $('#playPause'), prevAct: $('#prevAct'), nextAct: $('#nextAct'),
    prevActBottom: $('#prevActBottom'), nextActBottom: $('#nextActBottom'),
    currentTime: $('#currentTime'), duration: $('#duration'), progress: $('#progress'),
    speed: $('#speed'), autoFollow: $('#autoFollow'), sidebar: $('#bookSidebar'),
    backdrop: $('#sidebarBackdrop'), toggleSidebar: $('#toggleSidebar'), closeSidebar: $('#closeSidebar')
  };

  if (!el.audio || !el.bookText) {
    console.error('[Livro] HTML incompatível: #bookAudio ou #bookText não encontrado.');
    return;
  }

  const state = {
    actId: 1,
    loadedActId: null,
    changing: false,
    restoring: false,
    restoreTarget: null,
    loadToken: 0,
    timeline: [],
    activeId: null,
    lastFollowId: null,
    lastSaveMs: 0,
    idleTimer: null,
    store: readStore()
  };

  function defaultStore() {
    return { currentActId: 1, positions: {}, speed: 1, autoFollow: true };
  }

  function storageAvailable() {
    try {
      const k = '__kt_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (_) {
      return false;
    }
  }

  function readStore() {
    if (!storageAvailable()) return defaultStore();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultStore();
      const x = JSON.parse(raw);
      return {
        currentActId: Number.isInteger(x.currentActId) ? x.currentActId : 1,
        positions: x.positions && typeof x.positions === 'object' ? x.positions : {},
        speed: Number(x.speed) || 1,
        autoFollow: x.autoFollow !== false
      };
    } catch (e) {
      console.warn('[Livro] memória inválida; iniciando limpa.', e);
      return defaultStore();
    }
  }

  function writeStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.store));
    } catch (e) {
      console.error('[Livro] não consegui salvar localStorage.', e);
    }
  }

  function savedTime(actId) {
    const n = Number(state.store.positions[String(actId)]);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function savePosition(reason = 'auto', force = false) {
    // Esta trava é o ponto principal: durante troca de áudio, eventos de pause/src NÃO salvam 0.
    if (state.changing || state.restoring || state.loadedActId === null) return;
    const t = el.audio.currentTime;
    if (!Number.isFinite(t) || t < 0) return;

    const now = performance.now();
    if (!force && now - state.lastSaveMs < 500) return;
    state.lastSaveMs = now;

    state.store.currentActId = state.loadedActId;
    state.store.positions[String(state.loadedActId)] = t;
    state.store.speed = el.audio.playbackRate || 1;
    state.store.autoFollow = el.autoFollow ? el.autoFollow.checked : true;
    writeStore();

    console.log(`[Livro] SALVO ${reason} | ato ${state.loadedActId} | ${t.toFixed(3)}s`);
    renderActList();
  }

  function fmt(sec) {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const s = Math.floor(sec), m = Math.floor(s / 60), r = s % 60;
    return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
  }

  function esc(v) {
    return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;')
      .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function actById(id) { return ATOS[id - 1] || ATOS[0]; }

  function renderActList() {
    if (!el.actList) return;
    el.actList.innerHTML = ATOS.map(a => {
      const pos = savedTime(a.id);
      return `<button type="button" class="book-act-btn${a.id === state.actId ? ' is-active' : ''}" data-act="${a.id}">
        <span class="book-act-roman">${a.roman}</span>
        <span class="book-act-name">${esc(a.titulo)}</span>
        <span class="book-act-state">${pos > .5 ? fmt(pos) : 'Abrir'}</span>
      </button>`;
    }).join('');

    el.actList.querySelectorAll('[data-act]').forEach(b => {
      b.addEventListener('click', () => {
        openAct(Number(b.dataset.act));
        closeSidebar();
      });
    });
  }

  async function fetchData(act) {
    const r = await fetch(act.data, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${act.data} -> HTTP ${r.status}`);
    return r.json();
  }

  function waitMetadata(src, token) {
    return new Promise((resolve, reject) => {
      const ok = () => { cleanup(); if (token === state.loadToken) resolve(); };
      const bad = () => { cleanup(); reject(new Error(`Falha ao carregar ${src}`)); };
      const cleanup = () => {
        el.audio.removeEventListener('loadedmetadata', ok);
        el.audio.removeEventListener('error', bad);
      };
      el.audio.addEventListener('loadedmetadata', ok);
      el.audio.addEventListener('error', bad);
      el.audio.src = src;
      el.audio.load();
    });
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function renderText(data) {
    const chapters = data.capitulos || [];
    if (!chapters.length) {
      el.bookText.innerHTML = '<div class="book-empty">Sem texto para este ato.</div>';
      return [];
    }

    const flat = [];
    el.bookText.innerHTML = chapters.map((ch, ci) => {
      const parts = (ch.trechos || []).map((seg, si) => {
        const id = `segment-${ci + 1}-${si + 1}`;
        flat.push({
          id,
          chapterTitle: ch.titulo || `Capítulo ${ci + 1}`,
          text: String(seg.text || ''),
          start: num(seg.start),
          end: num(seg.end)
        });
        return `<p id="${id}" class="book-segment" tabindex="0">${esc(seg.text || '')}</p>`;
      }).join('');
      return `<article class="book-chapter">
        <p class="book-chapter-kicker">CAPÍTULO ${ci + 1}</p>
        <h3>${esc(ch.titulo || `Capítulo ${ci + 1}`)}</h3>
        <div class="book-chapter-content">${parts}</div>
      </article>`;
    }).join('');

    return flat;
  }

  function buildTimeline(flat, duration) {
    const exact = flat.length > 0 && flat.every(s =>
      s.start !== null && s.end !== null && s.end > s.start
    );

    if (exact) {
      console.log('[Livro] destaque usando os start/end presentes no JSON.');
      return flat;
    }

    console.log('[Livro] destaque APROXIMADO porque ainda existem start/end vazios.');
    const weights = flat.map(s => Math.max(1, s.text.trim().length));
    const total = weights.reduce((a,b) => a + b, 0) || 1;
    let cursor = 0;
    return flat.map((s, i) => {
      const start = cursor;
      const end = i === flat.length - 1 ? duration : cursor + duration * (weights[i] / total);
      cursor = end;
      return { ...s, start, end };
    });
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitForMediaData(timeoutMs = 8000) {
    const start = performance.now();

    while (performance.now() - start < timeoutMs) {
      if (el.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return true;

      await Promise.race([
        new Promise(resolve => el.audio.addEventListener('loadeddata', resolve, { once: true })),
        new Promise(resolve => el.audio.addEventListener('canplay', resolve, { once: true })),
        delay(250)
      ]);
    }

    return el.audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  async function restore(actId) {
    const wanted = savedTime(actId);
    const d = el.audio.duration;

    if (!(wanted > 0) || !Number.isFinite(d) || d <= 0) {
      state.restoreTarget = null;
      console.log(`[Livro] sem ponto salvo para restaurar no ato ${actId}.`);
      return true;
    }

    const target = Math.min(wanted, Math.max(0, d - .05));
    state.restoreTarget = target;

    await waitForMediaData(8000);

    for (let attempt = 1; attempt <= 12; attempt++) {
      try {
        if (typeof el.audio.fastSeek === 'function') {
          el.audio.fastSeek(target);
        } else {
          el.audio.currentTime = target;
        }
      } catch (error) {
        console.warn(`[Livro] tentativa ${attempt} de seek falhou:`, error);
      }

      await Promise.race([
        new Promise(resolve => el.audio.addEventListener('seeked', resolve, { once: true })),
        new Promise(resolve => el.audio.addEventListener('timeupdate', resolve, { once: true })),
        delay(450)
      ]);

      const actual = el.audio.currentTime;
      const diff = Math.abs(actual - target);

      console.log(
        `[Livro] RESTORE tentativa ${attempt} | alvo ${target.toFixed(3)}s | atual ${actual.toFixed(3)}s | diferença ${diff.toFixed(3)}s`
      );

      if (diff <= .75) {
        console.log(`[Livro] RESTAURADO ato ${actId} com sucesso em ${actual.toFixed(3)}s`);
        return true;
      }

      await delay(300);
    }

    console.error(
      `[Livro] NÃO CONSEGUI RESTAURAR ato ${actId}. O servidor local provavelmente não oferece HTTP Range/206.`
    );
    return false;
  }

  async function openAct(actId) {
    if (!Number.isInteger(actId) || actId < 1 || actId > 10) return;

    // 1) salva o ato antigo ANTES de trocar qualquer estado/source.
    savePosition('antes-da-troca', true);

    // 2) trava salvamento. pause/src podem zerar currentTime, mas não poderão sobrescrever memória.
    state.changing = true;
    state.restoring = true;
    state.restoreTarget = null;
    el.audio.pause();

    const token = ++state.loadToken;
    const act = actById(actId);
    state.actId = actId;
    state.loadedActId = null;
    state.timeline = [];
    state.activeId = null;
    state.lastFollowId = null;

    state.store.currentActId = actId;
    writeStore();

    if (el.actNumber) el.actNumber.textContent = `ATO ${act.roman}`;
    if (el.actTitle) el.actTitle.textContent = act.titulo;
    if (el.chapterNow) el.chapterNow.textContent = 'Carregando...';
    el.bookText.classList.remove('has-reading');
    el.bookText.innerHTML = '<div class="book-loading">Carregando ato...</div>';
    renderActList();
    updateNav();

    try {
      const [data] = await Promise.all([fetchData(act), waitMetadata(act.audio, token)]);
      if (token !== state.loadToken) return;

      if (data.titulo) {
        act.titulo = data.titulo;
        if (el.actTitle) el.actTitle.textContent = data.titulo;
      }

      const flat = renderText(data);
      state.timeline = buildTimeline(flat, el.audio.duration);

      const restored = await restore(actId);
      if (token !== state.loadToken) return;

      state.loadedActId = actId;
      state.changing = false;
      state.restoring = false;
      state.restoreTarget = null;
      updateProgress();
      renderActList();

      console.log(
        `[Livro] ATO ${actId} PRONTO | restore=${restored ? 'OK' : 'FALHOU'} | memória atual:`,
        JSON.stringify(state.store)
      );
    } catch (e) {
      state.changing = false;
      state.restoring = false;
      state.restoreTarget = null;
      state.loadedActId = actId;
      console.error('[Livro]', e);
      if (el.chapterNow) el.chapterNow.textContent = 'Erro ao carregar';
      el.bookText.innerHTML = `<div class="book-empty">${esc(e.message)}</div>`;
    }
  }

  function currentSegment(time) {
    for (const s of state.timeline) if (time >= s.start && time < s.end) return s;
    return null;
  }

  function updateHighlight() {
    const cur = currentSegment(el.audio.currentTime);
    if (state.activeId !== cur?.id) {
      if (state.activeId) document.getElementById(state.activeId)?.classList.remove('is-reading');
      state.activeId = cur?.id || null;

      if (cur) {
        const node = document.getElementById(cur.id);
        node?.classList.add('is-reading');
        if (el.chapterNow) el.chapterNow.textContent = cur.chapterTitle;
        if (el.autoFollow?.checked && node && state.lastFollowId !== cur.id) {
          state.lastFollowId = cur.id;
          followNode(node);
        }
      }
    }

    el.bookText.classList.toggle('has-reading', Boolean(cur));
    for (const s of state.timeline) {
      const node = document.getElementById(s.id);
      if (node) node.classList.toggle('is-read', s.end <= el.audio.currentTime && s.id !== cur?.id);
    }
  }

  function updateProgress() {
    const t = el.audio.currentTime, d = el.audio.duration;
    if (el.currentTime) el.currentTime.textContent = fmt(t);
    if (el.duration) el.duration.textContent = fmt(d);
    if (el.progress) el.progress.value = Number.isFinite(d) && d > 0 ? Math.round((t / d) * 1000) : 0;
    updateHighlight();
  }

  function updatePlay() {
    const playing = !el.audio.paused && !el.audio.ended;
    if (el.playPause) el.playPause.textContent = playing ? '❚❚' : '▶';
    document.body.classList.toggle('is-playing', playing);

    if (playing) schedulePlayerHide();
    else showPlayerControls();
  }

  function updateNav() {
    if (el.prevAct) el.prevAct.disabled = state.actId === 1;
    if (el.prevActBottom) el.prevActBottom.disabled = state.actId === 1;
    if (el.nextAct) el.nextAct.disabled = state.actId === 10;
    if (el.nextActBottom) el.nextActBottom.disabled = state.actId === 10;
  }

  // "Acompanhar leitura" controla a visibilidade do texto e o auto-follow.
  function applyReadingMode({ scrollToCurrent = false } = {}) {
    const enabled = el.autoFollow ? el.autoFollow.checked : true;

    document.body.classList.toggle('book-follow-enabled', enabled);

    if (el.bookText) {
      el.bookText.hidden = !enabled;
      el.bookText.setAttribute('aria-hidden', enabled ? 'false' : 'true');
    }

    if (el.autoFollow) {
      el.autoFollow.setAttribute('aria-expanded', enabled ? 'true' : 'false');
    }

    if (!enabled) {
      showPlayerControls();
      if (el.chapterNow) el.chapterNow.textContent = 'Modo somente áudio';
      return;
    }

    if (scrollToCurrent && state.activeId) {
      const node = document.getElementById(state.activeId);
      if (node) followNode(node, true);
    }

    if (!el.audio.paused && !el.audio.ended) schedulePlayerHide();
  }

  // Mantém o trecho abaixo do player sticky, evitando sobreposição.
  function followNode(node, immediate = false) {
    if (!node || !el.autoFollow?.checked) return;

    const rect = node.getBoundingClientRect();
    const viewportTarget = window.innerHeight * (window.innerWidth <= 700 ? 0.68 : 0.64);
    const top = Math.max(0, window.scrollY + rect.top - viewportTarget);

    window.scrollTo({ top, behavior: immediate ? 'auto' : 'smooth' });
  }

  function showPlayerControls() {
    if (state.idleTimer) {
      clearTimeout(state.idleTimer);
      state.idleTimer = null;
    }
    document.body.classList.remove('book-player-idle');
  }

  function schedulePlayerHide() {
    showPlayerControls();
    if (!el.autoFollow?.checked || el.audio.paused || el.audio.ended) return;

    state.idleTimer = setTimeout(() => {
      if (el.autoFollow?.checked && !el.audio.paused && !el.audio.ended) {
        document.body.classList.add('book-player-idle');
      }
    }, 2600);
  }

  function registerPlayerActivity() {
    if (!el.autoFollow?.checked) return;
    showPlayerControls();
    if (!el.audio.paused && !el.audio.ended) schedulePlayerHide();
  }

  function openSidebar() {
    el.sidebar?.classList.add('is-open');
    if (el.backdrop) {
      el.backdrop.hidden = false;
      requestAnimationFrame(() => el.backdrop.classList.add('is-visible'));
    }
  }
  function closeSidebar() {
    el.sidebar?.classList.remove('is-open');
    if (el.backdrop) {
      el.backdrop.classList.remove('is-visible');
      setTimeout(() => { if (!el.backdrop.classList.contains('is-visible')) el.backdrop.hidden = true; }, 180);
    }
  }

  el.playPause?.addEventListener('click', () => el.audio.paused ? el.audio.play().catch(console.warn) : el.audio.pause());
  el.prevAct?.addEventListener('click', () => openAct(state.actId - 1));
  el.prevActBottom?.addEventListener('click', () => openAct(state.actId - 1));
  el.nextAct?.addEventListener('click', () => openAct(state.actId + 1));
  el.nextActBottom?.addEventListener('click', () => openAct(state.actId + 1));

  el.progress?.addEventListener('input', () => {
    if (!Number.isFinite(el.audio.duration) || el.audio.duration <= 0) return;
    el.audio.currentTime = Number(el.progress.value) / 1000 * el.audio.duration;
    updateProgress();
  });
  el.progress?.addEventListener('change', () => savePosition('barra', true));

  el.speed?.addEventListener('change', () => {
    el.audio.playbackRate = Number(el.speed.value) || 1;
    state.store.speed = el.audio.playbackRate;
    writeStore();
  });

  el.autoFollow?.addEventListener('change', () => {
    state.store.autoFollow = el.autoFollow.checked;
    writeStore();
    applyReadingMode({ scrollToCurrent: true });
  });

  el.audio.addEventListener('timeupdate', () => { updateProgress(); savePosition('timeupdate'); });
  el.audio.addEventListener('play', updatePlay);
  el.audio.addEventListener('pause', () => { updatePlay(); savePosition('pause', true); });
  el.audio.addEventListener('seeked', () => { updateProgress(); savePosition('seeked', true); });
  el.audio.addEventListener('ended', () => { updatePlay(); savePosition('ended', true); });

  el.toggleSidebar?.addEventListener('click', openSidebar);
  el.closeSidebar?.addEventListener('click', closeSidebar);
  el.backdrop?.addEventListener('click', closeSidebar);

  ['pointermove', 'pointerdown', 'touchstart', 'keydown'].forEach(eventName => {
    document.addEventListener(eventName, registerPlayerActivity, { passive: true });
  });

  window.addEventListener('pagehide', () => savePosition('pagehide', true));
  window.addEventListener('beforeunload', () => savePosition('beforeunload', true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePosition('aba-oculta', true); });

  state.actId = Number.isInteger(state.store.currentActId) ? state.store.currentActId : 1;
  if (el.speed) el.speed.value = String(state.store.speed || 1);
  el.audio.playbackRate = Number(el.speed?.value || 1);
  if (el.autoFollow) el.autoFollow.checked = state.store.autoFollow !== false;
  applyReadingMode();

  console.log('[Livro] localStorage:', storageAvailable() ? 'OK' : 'INDISPONÍVEL');
  console.log('[Livro] memória carregada:', JSON.stringify(state.store));

  renderActList();
  updateNav();
  openAct(state.actId);
})();
