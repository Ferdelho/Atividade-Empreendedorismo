/* =========================================================
   AcessoTeste — script.js
   1) Menu mobile
   2) Formulário de contato (validação acessível)
   3) Pagamento (modal de demonstração)
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

/* ---------- 3) Pagamento (modal de demonstração) ---------- */
/* ATENÇÃO: nada aqui cobra de verdade. Para produção, use um gateway
   (Mercado Pago, Pagar.me, Stripe...) com campos hospedados por ele —
   nunca envie número de cartão para o seu próprio servidor. */
(() => {
  const dialog = document.getElementById('pay-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return; // sem suporte: o link vai para #contato

  const PLANS = {
    rapido:   { name: 'Teste Rápido',   price: 149, perfis: 1, desc: '1 perfil · 1 testador · até 30 minutos' },
    completo: { name: 'Teste Completo', price: 449, perfis: 2, desc: '2 perfis · 2 testadores · até 3 fluxos · 1 reteste' },
  };
  const PIX_EXAMPLE =
    '00020126EXEMPLO-ILUSTRATIVO-NAO-PAGAR5204000053039865802BR5909AcessoTeste6009RIO BRANCO6304ABCD';

  const $ = (id) => document.getElementById(id);
  const form = $('pay-form');
  const done = $('pay-done');
  const msgEl = $('pay-msg');
  const money = (n) => 'R$ ' + n.toLocaleString('pt-BR');

  let plan = null;
  let opener = null;

  const method = () => form.querySelector('input[name="metodo"]:checked').value;

  const syncMethod = () => {
    const card = method() === 'cartao';
    $('pay-card').hidden = !card;
    $('pay-pix-info').hidden = card;
    $('pay-submit').textContent =
      (card ? 'Pagar com cartão ' : 'Pagar com Pix ') + '· ' + money(plan.price);
  };

  const open = (key, trigger) => {
    plan = PLANS[key];
    opener = trigger;
    form.reset();
    ['pay-url', 'pay-email', 'card-number', 'card-name', 'card-exp', 'card-cvv'].forEach((id) =>
      setFieldError($(id), '')
    );
    msgEl.textContent = '';
    form.hidden = false;
    done.hidden = true;
    $('pay-title').textContent = 'Contratar ' + plan.name;
    $('pay-sub').textContent = plan.desc;
    $('pay-total').textContent = money(plan.price);
    $('pay-perfil2-wrap').hidden = plan.perfis < 2;
    syncMethod();
    dialog.showModal();
    $('pay-url').focus();
  };

  // QR Code do Pix (gerado por js/qr.js). Se falhar, esconde só o QR e mantém o copia e cola.
  const renderQr = () => {
    const fig = $('pay-qr-fig');
    try {
      $('pay-qr').innerHTML = QR.svg(PIX_EXAMPLE, 'QR Code do Pix de exemplo');
      fig.hidden = false;
    } catch (_) {
      $('pay-qr').replaceChildren();
      fig.hidden = true;
    }
  };

  const close = () => dialog.close();

  document.querySelectorAll('[data-plan]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.preventDefault();
      open(el.dataset.plan, el);
    })
  );

  dialog.addEventListener('close', () => {
    if (opener) opener.focus();
  });
  $('pay-close').addEventListener('click', close);
  $('pay-finish').addEventListener('click', close);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close(); // clique no fundo escuro
  });

  form.querySelectorAll('input[name="metodo"]').forEach((r) => r.addEventListener('change', syncMethod));

  // Máscaras simples
  $('card-number').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 19);
    e.target.value = d.replace(/(.{4})/g, '$1 ').trim();
  });
  $('card-exp').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  });
  $('card-cvv').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
  ['pay-url', 'pay-email', 'card-number', 'card-name', 'card-exp', 'card-cvv'].forEach((id) =>
    $(id).addEventListener('input', () => setFieldError($(id), ''))
  );

  // Validações (retornam mensagem de erro ou '')
  const normalizeUrl = (v) => {
    const t = v.trim();
    if (!t) return null;
    const full = /^https?:\/\//i.test(t) ? t : 'https://' + t;
    try {
      const u = new URL(full);
      const ok = u.hostname === 'localhost' || /\.[a-z]{2,}$/i.test(u.hostname);
      return ok ? u.href : null;
    } catch (_) {
      return null;
    }
  };
  const checkExp = (v) => {
    const m = /^(\d{2})\/(\d{2})$/.exec(v);
    if (!m) return false;
    const month = +m[1];
    const year = 2000 + +m[2];
    if (month < 1 || month > 12) return false;
    const now = new Date();
    return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    msgEl.textContent = '';
    const invalid = [];
    const check = (input, error) => {
      setFieldError(input, error);
      if (error) invalid.push(input);
    };

    const url = normalizeUrl($('pay-url').value);
    check($('pay-url'), url ? '' : 'Informe o link do sistema, por exemplo https://homologacao.suaempresa.com.br.');
    check($('pay-email'), /^\S+@\S+\.\S+$/.test($('pay-email').value.trim()) ? '' : 'Informe um e-mail válido.');

    const card = method() === 'cartao';
    if (card) {
      check($('card-number'), /^\d{13,19}$/.test($('card-number').value.replace(/\s/g, '')) ? '' : 'Informe o número do cartão (13 a 19 dígitos).');
      check($('card-name'), $('card-name').value.trim().length >= 3 ? '' : 'Informe o nome impresso no cartão.');
      check($('card-exp'), checkExp($('card-exp').value) ? '' : 'Informe uma validade futura no formato MM/AA.');
      check($('card-cvv'), /^\d{3,4}$/.test($('card-cvv').value) ? '' : 'Informe o CVV (3 ou 4 dígitos).');
    }

    if (invalid.length) {
      msgEl.textContent = 'Corrija os campos indicados e tente novamente.';
      invalid[0].focus();
      return;
    }

    // TODO: enviar { plan, url, perfis, email, obs, método } ao seu back-end / gateway.
    // Os dados do cartão NÃO devem ser lidos nem enviados por aqui em produção.
    const perfis = [$('pay-perfil').value];
    if (plan.perfis > 1) perfis.push($('pay-perfil2').value);

    const rows = [
      ['Plano', plan.name],
      ['Sistema', url],
      ['Perfil(is)', perfis.join(' e ')],
      ['Relatório para', $('pay-email').value.trim()],
      ['Pagamento', card ? 'Cartão de crédito' : 'Pix'],
      ['Total', money(plan.price)],
    ];
    const list = $('pay-summary');
    list.replaceChildren();
    rows.forEach(([k, v]) => {
      const li = document.createElement('li');
      const a = document.createElement('span');
      const b = document.createElement('span');
      a.textContent = k;
      b.textContent = v;
      li.append(a, b);
      list.appendChild(li);
    });

    $('pay-done-title').textContent = card ? 'Pagamento aprovado (simulação)' : 'Pedido recebido';
    $('pay-done-text').textContent = card
      ? 'Em um ambiente real, o relatório seria enviado para o seu e-mail assim que os testes terminassem.'
      : 'Pague o Pix abaixo. Em um ambiente real, o teste começaria após a confirmação do pagamento.';
    $('pay-pix-box').hidden = card;
    $('pay-pix-code').value = PIX_EXAMPLE;
    renderQr();
    $('pay-copy-status').textContent = '';

    // Dados do cartão não ficam guardados
    form.reset();
    form.hidden = true;
    done.hidden = false;
    done.focus();
  });

  $('pay-copy').addEventListener('click', async () => {
    const status = $('pay-copy-status');
    try {
      await navigator.clipboard.writeText($('pay-pix-code').value);
      status.textContent = 'Código copiado.';
    } catch (_) {
      $('pay-pix-code').select();
      status.textContent = 'Selecione o código e copie manualmente (Ctrl+C).';
    }
  });
})();

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
