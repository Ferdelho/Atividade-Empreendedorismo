/* =========================================================
   AcessoTeste — script.js
   1) Menu mobile
   2) Formulário de contato (validação acessível)
   3) Teste de demonstração + relatório
   4) Narrador (Web Speech API)
   ========================================================= */

/* ---------- 1) Menu mobile ---------- */
const toggle = document.querySelector('.menu-toggle');
const menu = document.getElementById('menu');

const closeMenu = () => {
  menu.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
};

toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});

menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu.classList.contains('open')) {
    closeMenu();
    toggle.focus();
  }
});

/* ---------- 2) Formulário de contato ---------- */
const form = document.getElementById('lead-form');
const msg = document.getElementById('form-msg');

const setFieldError = (input, text) => {
  const err = document.getElementById(input.id + '-erro');
  if (text) {
    input.setAttribute('aria-invalid', 'true');
    err.textContent = text;
    err.hidden = false;
  } else {
    input.removeAttribute('aria-invalid');
    err.textContent = '';
    err.hidden = true;
  }
};

['nome', 'email'].forEach((id) => {
  form[id].addEventListener('input', () => setFieldError(form[id], ''));
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  msg.classList.remove('error');
  msg.textContent = '';

  const invalid = [];

  if (!form.nome.value.trim()) {
    setFieldError(form.nome, 'Informe seu nome.');
    invalid.push(form.nome);
  } else {
    setFieldError(form.nome, '');
  }

  if (!/^\S+@\S+\.\S+$/.test(form.email.value.trim())) {
    setFieldError(form.email, 'Informe um e-mail válido, por exemplo nome@empresa.com.');
    invalid.push(form.email);
  } else {
    setFieldError(form.email, '');
  }

  if (invalid.length) {
    msg.classList.add('error');
    msg.textContent = 'Corrija os campos indicados e envie novamente.';
    invalid[0].focus();
    return;
  }

  // TODO: enviar os dados para o seu back-end aqui (fetch/POST).
  msg.textContent = 'Solicitação enviada! Entraremos em contato em breve.';
  form.reset();
});

/* ---------- 3) Teste de demonstração + relatório ---------- */
const demoForm = document.getElementById('demo-form');
const demoErrors = document.getElementById('demo-errors');
const report = document.getElementById('relatorio');

const stripNumber = (text) => text.replace(/^\d+\.\s*/, '').trim();

const fillList = (ul, items, emptyText) => {
  ul.replaceChildren();
  if (!items.length) {
    const li = document.createElement('li');
    li.textContent = emptyText;
    ul.appendChild(li);
    return;
  }
  items.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  });
};

const hideReportAndErrors = () => {
  demoErrors.hidden = true;
  demoErrors.replaceChildren();
  report.hidden = true;
};

demoForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const questions = [...demoForm.querySelectorAll('fieldset.question')];
  const missing = questions.filter((q) => !q.querySelector('input:checked'));

  // Resumo de erros (padrão acessível: foco no resumo + links para os campos)
  if (missing.length) {
    demoErrors.replaceChildren();

    const title = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = missing.length === 1
      ? 'Falta responder 1 pergunta:'
      : `Faltam responder ${missing.length} perguntas:`;
    title.appendChild(strong);

    const ul = document.createElement('ul');
    missing.forEach((q) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + q.id;
      a.textContent = stripNumber(q.querySelector('legend').textContent);
      li.appendChild(a);
      ul.appendChild(li);
    });

    demoErrors.append(title, ul);
    demoErrors.hidden = false;
    report.hidden = true;
    demoErrors.focus();
    return;
  }

  demoErrors.hidden = true;

  const answers = questions.map((q) => ({
    text: stripNumber(q.querySelector('legend').textContent),
    issue: q.dataset.issue || stripNumber(q.querySelector('legend').textContent),
    value: q.querySelector('input:checked').value,
  }));

  const failed = answers.filter((a) => a.value === 'nao');
  const passed = answers.filter((a) => a.value === 'sim');
  const skipped = answers.filter((a) => a.value === 'na');
  const evaluated = passed.length + failed.length;
  const pct = evaluated ? Math.round((passed.length / evaluated) * 100) : 0;

  document.getElementById('relatorio-data').textContent =
    'Gerado em ' + new Date().toLocaleDateString('pt-BR');

  document.getElementById('relatorio-resumo').textContent = evaluated
    ? `${passed.length} de ${evaluated} itens aprovados (${pct}%).` +
      (skipped.length ? ` ${skipped.length} não se aplicava(m).` : '')
    : 'Nenhum item foi avaliado.';

  fillList(
    document.getElementById('relatorio-falhas'),
    failed.map((a) => a.issue),
    'Nenhuma barreira encontrada neste roteiro.'
  );
  fillList(
    document.getElementById('relatorio-ok'),
    passed.map((a) => a.text),
    'Nenhum item aprovado.'
  );

  const obs = demoForm.observacoes.value.trim();
  document.getElementById('relatorio-obs').textContent = obs || 'Sem observações do testador.';

  report.hidden = false;
  report.focus(); // leitor de tela lê o título do relatório
});

demoForm.addEventListener('reset', hideReportAndErrors);

demoErrors.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  e.preventDefault();
  const fieldset = document.getElementById(a.hash.slice(1));
  const first = fieldset && fieldset.querySelector('input');
  if (first) first.focus();
});

document.getElementById('relatorio-imprimir').addEventListener('click', () => window.print());

document.getElementById('relatorio-refazer').addEventListener('click', () => {
  demoForm.reset(); // dispara o evento "reset" que esconde o relatório
  const first = demoForm.querySelector('input');
  if (first) first.focus();
});

/* ---------- 4) Narrador (Web Speech API) ---------- */
(() => {
  const panel = document.getElementById('narrator');
  if (!panel) return;

  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    panel.hidden = true; // navegador sem suporte
    return;
  }

  const playBtn = document.getElementById('narrator-play');
  const playLabel = playBtn.querySelector('.label');
  const playIcon = playBtn.querySelector('.emoji');
  const stopBtn = document.getElementById('narrator-stop');
  const rateSel = document.getElementById('narrator-rate');
  const status = document.getElementById('narrator-status');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let queue = [];
  let index = 0;
  let state = 'idle'; // idle | playing | paused
  let current = null;
  let voice = null;
  let highlighted = null;

  // Escolhe uma voz em português (a lista pode carregar depois)
  const pickVoice = () => {
    const voices = synth.getVoices();
    voice =
      voices.find((v) => v.lang === 'pt-BR') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('pt')) ||
      null;
  };
  pickVoice();
  synth.onvoiceschanged = pickVoice;

  // Monta a fila de texto a partir do conteúdo principal
  const buildQueue = () => {
    const nodes = document.querySelectorAll(
      'main h1, main h2, main h3, main p, main li, main summary, main .mock[aria-label]'
    );
    const items = [];
    nodes.forEach((el) => {
      if (el.closest('[aria-hidden="true"], [hidden], form')) return;
      if (el.closest('.mock') && !el.matches('.mock')) return;
      if (el.closest('details:not([open])') && !el.matches('summary')) return;
      if (el.matches('li') && el.querySelector('h3, p')) return; // evita ler duas vezes
      const raw = el.matches('.mock') ? el.getAttribute('aria-label') : el.textContent;
      const text = raw.replace(/\s+/g, ' ').trim();
      if (text) items.push({ el, text });
    });
    return items;
  };

  const clearHighlight = () => {
    if (highlighted) highlighted.classList.remove('narrating');
    highlighted = null;
  };

  const highlight = (el) => {
    clearHighlight();
    el.classList.add('narrating');
    highlighted = el;
    const r = el.getBoundingClientRect();
    if (r.top < 90 || r.bottom > window.innerHeight - 110) {
      el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };

  const updateUI = () => {
    playLabel.textContent =
      state === 'playing' ? 'Pausar' : state === 'paused' ? 'Continuar' : 'Ouvir a página';
    playIcon.textContent = state === 'playing' ? '⏸' : state === 'paused' ? '▶' : '🔊';
    stopBtn.disabled = state === 'idle';
    panel.dataset.state = state;
  };

  const say = (text) => { status.textContent = text; };

  const speakCurrent = () => {
    if (index >= queue.length) {
      stopNarration('Narração concluída.');
      return;
    }
    const item = queue[index];
    highlight(item.el);

    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'pt-BR';
    if (voice) u.voice = voice;
    u.rate = parseFloat(rateSel.value) || 1;

    u.onend = () => {
      if (state === 'playing' && current === u) {
        index += 1;
        speakCurrent();
      }
    };
    u.onerror = (ev) => {
      if (ev.error === 'canceled' || ev.error === 'interrupted') return;
      stopNarration('Não foi possível narrar a página neste navegador.');
    };

    current = u;
    synth.speak(u);
  };

  const stopNarration = (message = 'Narração parada.') => {
    state = 'idle';
    current = null;
    synth.cancel();
    clearHighlight();
    updateUI();
    say(message);
  };

  playBtn.addEventListener('click', () => {
    if (state === 'idle') {
      queue = buildQueue();
      if (!queue.length) return;
      index = 0;
      state = 'playing';
      updateUI();
      say('Narração iniciada.');
      speakCurrent();
    } else if (state === 'playing') {
      synth.pause();
      state = 'paused';
      updateUI();
      say('Narração pausada.');
    } else {
      state = 'playing';
      synth.resume();
      if (!synth.speaking) speakCurrent(); // alguns navegadores móveis cancelam ao pausar
      updateUI();
      say('Narração retomada.');
    }
  });

  stopBtn.addEventListener('click', () => stopNarration());

  rateSel.addEventListener('change', () => {
    if (state === 'playing') {
      current = null;
      synth.cancel();
      speakCurrent(); // reinicia o trecho atual na nova velocidade
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state !== 'idle') stopNarration();
  });

  window.addEventListener('pagehide', () => synth.cancel());

  updateUI();
})();
