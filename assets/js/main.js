(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
  let lenis = null;

  // Executa fn no próximo quadro após cada rolagem (no máximo uma vez por quadro)
  function onScroll(fn) {
    let ticking = false;
    const run = () => {
      ticking = false;
      fn();
    };
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(run);
      }
    }, { passive: true });
    window.addEventListener('resize', fn);
    fn();
  }

  // Chama cb uma única vez para cada elemento, quando ele entra na tela
  function onceVisible(elements, cb, options) {
    // o mesmo elemento pode aparecer duas vezes num lote de entradas; roda só uma vez
    const done = new WeakSet();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !done.has(entry.target)) {
          done.add(entry.target);
          cb(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, options || { threshold: 0.2 });
    elements.forEach((el) => io.observe(el));
  }

  // Envolve cada palavra dos nós de texto de `root` com make(palavra), preservando <strong>, <br> etc.
  function splitWords(root, make) {
    [...root.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          frag.appendChild(/^\s+$/.test(part) ? document.createTextNode(part) : make(part));
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        splitWords(child, make);
      }
    });
  }

  function initLenis() {
    if (REDUCED || typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  // Títulos das seções: palavras sobem por uma máscara, em sequência
  function initHeadingReveal() {
    if (REDUCED) return;
    // "Como eu trabalho" tem surgimento próprio (initTypeHeading)
    const headings = [...document.querySelectorAll('.heading-medium')].filter((h) => !h.closest('#metrics'));
    headings.forEach((h) => {
      let i = 0;
      splitWords(h, (word) => {
        const mask = document.createElement('span');
        const inner = document.createElement('span');
        mask.className = 'split-word';
        inner.textContent = word;
        inner.style.setProperty('--i', i++);
        mask.appendChild(inner);
        return mask;
      });
    });
    onceVisible(headings, (h) => h.classList.add('is-revealed'), { threshold: 0.3 });
  }

  // Textos do Sobre: as palavras passam de cinza-claro a preto conforme a leitura avança
  function initWordScroll() {
    if (REDUCED) return;
    const paragraphs = [...document.querySelectorAll('#about .paragraph')];
    if (!paragraphs.length) return;

    const words = [];
    paragraphs.forEach((p) => splitWords(p, (word) => {
      const span = document.createElement('span');
      span.className = 'scroll-word';
      span.textContent = word;
      words.push(span);
      return span;
    }));

    const first = paragraphs[0];
    const last = paragraphs[paragraphs.length - 1];
    const lastO = new Array(words.length).fill(-1);
    onScroll(() => {
      const vh = window.innerHeight;
      const top = first.getBoundingClientRect().top;
      const bottom = last.getBoundingClientRect().bottom;
      if (bottom < 0 || top > vh) return;
      // começa quando o texto chega a 85% da tela e termina quando o fim dele passa de 55%
      const start = vh * 0.85;
      const end = vh * 0.55;
      const progress = Math.min(1, Math.max(0, (start - top) / (bottom - top + start - end)));
      const lit = progress * words.length;
      words.forEach((w, k) => {
        const o = Math.round(Math.min(1, Math.max(0.16, lit - k + 0.16)) * 100) / 100;
        if (o !== lastO[k]) {
          lastO[k] = o;
          w.style.setProperty('--o', o);
        }
      });
    });
  }

  // Retrato: revela de baixo para cima, tem parallax na rolagem e inclina seguindo o mouse
  function initPortrait() {
    const wrap = document.querySelector('.about-image-wrapper');
    if (!wrap) return;
    if (REDUCED) {
      wrap.classList.add('is-revealed');
      return;
    }
    onceVisible([wrap], (el) => el.classList.add('is-revealed'), { threshold: 0.25 });

    const card = wrap.querySelector('.position-relative');
    onScroll(() => {
      const r = wrap.getBoundingClientRect();
      const offset = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      card.style.setProperty('--py', (offset * -60).toFixed(1) + 'px');
    });

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
      });
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    }
  }

  // "Como eu trabalho": o título é digitado com um cursor piscando
  function initTypeHeading() {
    const h = document.querySelector('#metrics .heading-medium');
    if (!h || REDUCED) return;
    const text = h.textContent;
    h.setAttribute('aria-label', text);
    h.textContent = '';
    // cada letra já ocupa o seu espaço (invisível), então o título não "pula" enquanto é digitado
    const chars = [...text].map((ch) => {
      const span = document.createElement('span');
      span.className = 'type-char';
      span.textContent = ch;
      span.setAttribute('aria-hidden', 'true');
      h.appendChild(span);
      return span;
    });
    onceVisible([h], () => {
      let k = 0;
      const step = () => {
        if (k > 0) chars[k - 1].classList.remove('is-caret');
        chars[k].classList.add('is-typed', 'is-caret');
        k++;
        if (k < chars.length) setTimeout(step, 45 + Math.random() * 55);
        else setTimeout(() => chars[k - 1].classList.remove('is-caret'), 2600);
      };
      step();
    }, { threshold: 0.5 });
  }

  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#{}<>/+=*';

  // Troca o texto por caracteres aleatórios que vão se fixando da esquerda para a direita
  function decode(el, duration) {
    // guarda o texto original: uma segunda chamada no meio da animação não pode ler o texto embaralhado
    el.dataset.text ??= el.textContent;
    const text = el.dataset.text;
    const letters = [...text];
    const size = document.createElement('span');
    const live = document.createElement('span');
    size.className = 'decode-size';
    size.textContent = text;
    live.className = 'decode-live';
    live.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    el.append(size, live);

    const resolveAt = letters.map((_, i) => (i / letters.length) * duration * 0.65 + Math.random() * duration * 0.35);
    const start = performance.now();
    let lastSwap = 0;
    const tick = (now) => {
      const t = now - start;
      if (t >= duration) {
        el.textContent = text;
        return;
      }
      if (now - lastSwap > 45) {
        lastSwap = now;
        live.textContent = letters
          .map((ch, i) => (ch === ' ' || t >= resolveAt[i] ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join('');
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Cards de "Como eu trabalho": cada um é "compilado" — a borda é desenhada, o valor é decodificado
  // e o texto entra por último. O brilho que segue o mouse vale sempre.
  function initCards() {
    const cards = [...document.querySelectorAll('.metrics-grid .metric-card')];
    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
    if (REDUCED || !cards.length) return;

    const NS = 'http://www.w3.org/2000/svg';
    cards.forEach((card) => {
      const svg = document.createElementNS(NS, 'svg');
      const rect = document.createElementNS(NS, 'rect');
      svg.setAttribute('class', 'card-outline');
      svg.setAttribute('aria-hidden', 'true');
      rect.setAttribute('pathLength', '1');
      svg.appendChild(rect);
      card.appendChild(svg);
      card.classList.add('is-pending');
    });

    // o contorno acompanha o tamanho real de cada card
    const fitOutlines = () => cards.forEach((card) => {
      const w = card.clientWidth;
      const h = card.clientHeight;
      const r = Math.max(0, (parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0) - 1);
      const svg = card.querySelector('.card-outline');
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const attrs = { x: 0.5, y: 0.5, width: w - 1, height: h - 1, rx: r, ry: r };
      Object.entries(attrs).forEach(([k, v]) => svg.firstChild.setAttribute(k, v));
    });
    fitOutlines();
    window.addEventListener('resize', fitOutlines);

    onceVisible(cards, (card) => {
      const delay = (cards.indexOf(card) % 3) * 180;
      setTimeout(() => {
        card.classList.add('is-compiling');
        setTimeout(() => {
          card.classList.remove('is-pending');
          decode(card.querySelector('.metric-value'), 900);
        }, 550);
      }, delay);
    }, { threshold: 0.35 });
  }

  // Terminal: roda uma apresentação sozinho e depois aceita comandos do visitante
  function initTerminal() {
    const term = document.querySelector('.terminal');
    if (!term) return;
    const body = term.querySelector('.terminal-body');
    const output = term.querySelector('.terminal-output');
    const form = term.querySelector('.terminal-input-line');
    const input = term.querySelector('.terminal-input');
    const PROMPT = 'gustavo@portfolio:~$';

    // mesma ordem dos cards em "Projetos Selecionados"
    const PROJECTS = ['homecare', 'captacao-ia', 'central-whatsapp', 'designer-pedras', 'automacao-ia', 'dashboards'];
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const k = (t) => `<span class="k">"${t}"</span>`;
    const str = (t) => `<span class="s">"${t}"</span>`;
    const arr = (items) => `[${items.map(str).join(', ')}]`;

    const OUTPUTS = {
      whoami: [
        'Gustavo Santos',
        '<span class="d">Engenheiro de Software · Sistemas, APIs &amp; IA Aplicada</span>',
      ],
      stack: [
        '{',
        `  ${k('backend')}: ${arr(['C#', '.NET 8', 'ASP.NET Core', 'EF Core', 'Python', 'FastAPI'])},`,
        `  ${k('frontend')}: ${arr(['React', 'Vite', 'JavaScript'])},`,
        `  ${k('dados')}: ${arr(['PostgreSQL', 'Redis', 'pgvector', 'Pandas'])},`,
        `  ${k('ia')}: ${arr(['LLM tool calling', 'Agno', 'LangChain', 'N8N'])},`,
        `  ${k('infra')}: ${arr(['Docker', 'Caddy', 'Linux'])}`,
        '}',
      ],
      projetos: [PROJECTS.map((p) => p + '/').join('  '), '<span class="d">Use: open &lt;projeto&gt;  (ex.: open homecare)</span>'],
      status: ['<span class="ok">●</span> Disponível para novos projetos'],
      contato: [
        'e-mail     <a href="mailto:gugmoises@gmail.com">gugmoises@gmail.com</a>',
        'whatsapp   <a href="https://wa.me/5541995961197" target="_blank" rel="noopener">abrir conversa</a>',
        'linkedin   <a href="https://www.linkedin.com/in/gustavosantos-s/" target="_blank" rel="noopener">/in/gustavosantos-s</a>',
        'github     <a href="https://github.com/gustavosantos-s" target="_blank" rel="noopener">/gustavosantos-s</a>',
      ],
      help: [
        'Comandos disponíveis:',
        '  <span class="k">whoami</span>           quem sou eu',
        '  <span class="k">stack</span>            tecnologias que eu uso',
        '  <span class="k">projetos</span>         lista os projetos',
        '  <span class="k">open</span> &lt;projeto&gt;   abre os detalhes de um projeto',
        '  <span class="k">contato</span>          como falar comigo',
        '  <span class="k">status</span>           disponibilidade',
        '  <span class="k">clear</span>            limpa o terminal',
        '<span class="d">Dica: ↑/↓ navegam no histórico e Tab completa.</span>',
      ],
    };
    const ALIASES = { 'cat stack.json': 'stack', 'ls projetos': 'projetos', 'ls projetos/': 'projetos', 'cat contato.txt': 'contato' };
    const COMMANDS = ['help', 'whoami', 'stack', 'projetos', 'open', 'contato', 'status', 'clear', 'ls'];

    const MAX_LINES = 120;
    // Sem rolagem interna (ela brigava com a rolagem suave da página): o terminal cresce com o conteúdo.
    // Mantém só as últimas linhas, para ele não crescer sem fim.
    const trim = () => {
      while (output.children.length > MAX_LINES) output.firstElementChild.remove();
    };
    // Depois de um comando do visitante, rola a página só o suficiente para o campo continuar visível
    const keepInputVisible = () => {
      const r = form.getBoundingClientRect();
      const overflow = r.bottom - (window.innerHeight - 32);
      if (overflow <= 0) return;
      if (lenis) lenis.scrollTo(window.scrollY + overflow, { duration: 0.6 });
      else window.scrollBy({ top: overflow, behavior: REDUCED ? 'auto' : 'smooth' });
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, REDUCED ? 0 : ms));

    function commandLine(cmd) {
      const line = document.createElement('div');
      line.className = 'terminal-line';
      const prompt = document.createElement('span');
      prompt.className = 'terminal-prompt';
      prompt.textContent = PROMPT;
      const text = document.createElement('span');
      text.className = 'terminal-cmd';
      text.textContent = cmd;
      line.append(prompt, text);
      output.appendChild(line);
      trim();
      return text;
    }

    async function print(lines, cls = '') {
      const out = document.createElement('div');
      out.className = 'terminal-out ' + cls;
      output.appendChild(out);
      for (const html of lines) {
        out.insertAdjacentHTML('beforeend', html + '\n');
        await wait(35);
      }
    }

    // digita um comando letra por letra, com o cursor de bloco
    async function typeCommand(cmd) {
      const text = commandLine('');
      const caret = document.createElement('span');
      caret.className = 'terminal-caret';
      text.after(caret);
      await wait(350);
      for (const ch of cmd) {
        text.textContent += ch;
        await wait(40 + Math.random() * 60);
      }
      await wait(250);
      caret.remove();
    }

    async function run(raw) {
      const cmd = raw.trim().replace(/\s+/g, ' ');
      const lower = cmd.toLowerCase();
      if (!cmd) return;
      const name = ALIASES[lower] || lower.split(' ')[0];
      const arg = lower.split(' ').slice(1).join(' ');

      if (name === 'clear') {
        output.textContent = '';
        return;
      }
      if (name === 'ls') {
        await print(['projetos/  stack.json  contato.txt']);
        return;
      }
      if (name === 'open') {
        const i = PROJECTS.indexOf(arg.replace(/\/$/, ''));
        if (i === -1) {
          await print([arg ? `projeto não encontrado: ${esc(arg)}` : 'uso: open &lt;projeto&gt;', '<span class="d">Rode projetos para ver a lista.</span>'], 'err');
          return;
        }
        await print([`abrindo <span class="k">${PROJECTS[i]}</span>…`]);
        await wait(400);
        document.querySelectorAll('.project-link')[i]?.click();
        return;
      }
      if (lower === 'sudo contratar' || lower === 'sudo hire') {
        await print(['[sudo] senha para recrutador: ********']);
        await wait(700);
        await print(['<span class="ok">Permissão concedida.</span> Abrindo seu e-mail…']);
        await wait(900);
        window.location.href = 'mailto:gugmoises@gmail.com?subject=' + encodeURIComponent('Vamos conversar sobre uma oportunidade');
        return;
      }
      if (lower.startsWith('sudo')) {
        await print(['Boa tentativa. Experimente <span class="k">sudo contratar</span>.'], 'd');
        return;
      }
      if (OUTPUTS[name]) {
        await print(OUTPUTS[name]);
        return;
      }
      await print([`comando não encontrado: ${esc(cmd)}`, '<span class="d">Digite help para ver os comandos.</span>'], 'err');
    }

    // apresentação automática
    async function intro() {
      for (const [typed, key] of [['whoami', 'whoami'], ['cat stack.json', 'stack'], ['ls projetos/', 'projetos'], ['status', 'status']]) {
        await typeCommand(typed);
        await print(OUTPUTS[key]);
        await wait(300);
      }
      await print(['<span class="d">Sua vez: digite help e aperte Enter.</span>']);
      term.classList.add('is-ready');
    }

    const history = [];
    let cursor = 0;
    let busy = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const value = input.value;
      input.value = '';
      commandLine(value);
      if (value.trim()) history.push(value.trim());
      cursor = history.length;
      busy = true;
      await run(value);
      busy = false;
      trim();
      keepInputVisible();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        cursor = Math.max(0, Math.min(history.length, cursor + (e.key === 'ArrowUp' ? -1 : 1)));
        input.value = history[cursor] || '';
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const v = input.value.toLowerCase();
        const pool = v.startsWith('open ') ? PROJECTS.map((p) => 'open ' + p) : COMMANDS;
        const matches = pool.filter((c) => c.startsWith(v));
        if (matches.length === 1) input.value = matches[0] + (v.startsWith('open ') ? '' : ' ');
      }
    });

    // clicar em qualquer ponto do terminal foca o campo, sem mover a página
    body.addEventListener('click', () => {
      if (term.classList.contains('is-ready') && !window.getSelection().toString()) input.focus({ preventScroll: true });
    });

    onceVisible([term], () => {
      term.classList.add('is-revealed');
      setTimeout(intro, REDUCED ? 0 : 500);
    }, { threshold: 0.35 });
  }

  // Cursor personalizado: ponto + anel com inércia, com estados sobre links, projetos e campos de texto.
  // Botões principais ficam "magnéticos". Só em telas com mouse e sem "reduzir movimento".
  function initCursor() {
    if (REDUCED || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const root = document.documentElement;
    const dot = document.createElement('div');
    const ring = document.createElement('div');
    const label = document.createElement('span');
    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';
    label.className = 'cursor-label';
    label.textContent = 'Ver';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    ring.appendChild(label);
    document.body.append(dot, ring);
    root.classList.add('has-cursor');

    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      root.classList.add('cursor-visible');
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    }, { passive: true });
    root.addEventListener('mouseleave', () => root.classList.remove('cursor-visible'));
    window.addEventListener('mousedown', () => ring.classList.add('is-down'));
    window.addEventListener('mouseup', () => ring.classList.remove('is-down'));

    const follow = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);

    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      const view = !!t.closest('.project-link');
      ring.classList.toggle('is-view', view);
      dot.classList.toggle('is-hidden', view); // o "Ver" fica legível sem o ponto por cima
      ring.classList.toggle('is-text', !!t.closest('input, textarea'));
      ring.classList.toggle('is-link', !view && !!t.closest('a, button, [role="button"], summary, label'));
    });

    document.querySelectorAll('.ds-hero-nav a, .contact-link, .footer-link, .button, .project-lightbox-close').forEach((el) => {
      const strength = el.matches('.contact-link, .footer-link') ? 0.2 : 0.35;
      el.classList.add('magnetic');
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(x * strength).toFixed(1)}px ${(y * strength).toFixed(1)}px`;
      });
      el.addEventListener('mouseleave', () => { el.style.translate = ''; });
    });
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: '0px 0px -50px 0px' }
  );

  function initScrollReveal() {
    const animElements = document.querySelectorAll('[data-anim-id]');
    animElements.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = `opacity 1s ${EASE_OUT}, transform 1s ${EASE_OUT}`;
      revealObserver.observe(el);
    });
  }

  function initNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.navigation-link');

    if (!sections.length || !navLinks.length) return;

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              const href = link.getAttribute('href');
              if (href && href.includes('#' + id)) {
                link.classList.add('is-current');
              } else {
                link.classList.remove('is-current');
              }
            });
          }
        });
      },
      { threshold: 0.3, rootMargin: '-10% 0px -60% 0px' }
    );

    sections.forEach((section) => sectionObserver.observe(section));
  }

  function initNavFlip() {
    const links = document.querySelectorAll('.navigation-link, .footer-link');
    links.forEach((link) => {
      const front = link.querySelector(
        '.navigation-link-front, .footer-link-front'
      );
      const back = link.querySelector(
        '.navigation-link-back, .footer-link-back'
      );
      if (!front || !back) return;

      link.addEventListener('mouseenter', () => {
        front.style.transform = 'translateY(-100%)';
        front.style.transition = 'transform 0.35s cubic-bezier(0.65, 0, 0.35, 1)';
        back.style.opacity = '1';
        back.style.transform = 'translateY(0)';
        back.style.transition = 'transform 0.35s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.2s';
      });

      link.addEventListener('mouseleave', () => {
        front.style.transform = 'translateY(0)';
        back.style.opacity = '0';
        back.style.transform = 'translateY(100%)';
      });
    });
  }

  function initButtonFlip() {
    const buttons = document.querySelectorAll('.button');
    buttons.forEach((btn) => {
      const textFront = btn.querySelector('.button-text-wrapper');
      const textBack = btn.querySelector('.button-text-back');
      if (!textFront || !textBack) return;

      btn.addEventListener('mouseenter', () => {
        textFront.style.transform = 'translateY(-100%)';
        textFront.style.transition = 'transform 0.35s cubic-bezier(0.65, 0, 0.35, 1)';
        textBack.style.transform = 'translateY(0)';
        textBack.style.transition = 'transform 0.35s cubic-bezier(0.65, 0, 0.35, 1)';
      });

      btn.addEventListener('mouseleave', () => {
        textFront.style.transform = 'translateY(0)';
        textBack.style.transform = 'translateY(100%)';
      });
    });
  }

  function initLightbox() {
    const projectLinks = document.querySelectorAll('.project-link');
    const lightboxWrappers = document.querySelectorAll(
      '.project-lightbox-wrapper'
    );
    const closeBtns = document.querySelectorAll('.project-lightbox-close');
    const backgrounds = document.querySelectorAll(
      '.project-lightbox-background'
    );

    // FIX: Move all lightboxes to the root body to prevent ancestor 'transform' from breaking 'position: fixed'
    lightboxWrappers.forEach((wrapper) => {
      wrapper.setAttribute('data-lenis-prevent', '');
      document.body.appendChild(wrapper);
    });

    // Card que abriu o lightbox, para devolver o foco a ele ao fechar
    let opener = null;

    projectLinks.forEach((link, index) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const wrapper = lightboxWrappers[index];
        if (wrapper) {
          opener = link;
          // O conteúdo do modal aparece inteiro de uma vez: não depende do observer de rolagem,
          // que não dispara para elementos dentro do lightbox (título, imagem e botão ficavam invisíveis)
          wrapper.querySelectorAll('[data-anim-id]').forEach((el) => el.classList.add('revealed'));
          wrapper.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          lenis?.stop();
          requestAnimationFrame(() => {
            wrapper.style.opacity = '1';
            wrapper.querySelector('.project-lightbox-close')?.focus({ preventScroll: true });
          });
        }
      });
    });

    function closeLightbox(wrapper) {
      if (!wrapper) return;
      wrapper.style.opacity = '0';
      document.body.style.overflow = '';
      lenis?.start();
      setTimeout(() => {
        wrapper.style.display = 'none';
      }, 300);
      opener?.focus({ preventScroll: true });
      opener = null;
    }

    closeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const wrapper = btn.closest('.project-lightbox-wrapper');
        closeLightbox(wrapper);
      });
    });

    lightboxWrappers.forEach((wrapper) => {
      wrapper.addEventListener('click', (e) => {
        // If the user clicks directly on the wrapper, the background, or an empty area of the lightbox
        if (
          e.target === wrapper ||
          e.target.classList.contains('project-lightbox-background') ||
          e.target.classList.contains('project-lightbox')
        ) {
          closeLightbox(wrapper);
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        lightboxWrappers.forEach((w) => {
          if (w.style.display === 'flex') closeLightbox(w);
        });
      }
    });
    lightboxWrappers.forEach((w) => {
      w.style.transition = 'opacity 0.3s ease';
      w.style.opacity = '0';
    });
  }

  function initSmoothScroll() {
    // Função de Easing: easeInOutQuart para um deslizar luxuoso
    const ease = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const target = targetId === '#top' ? document.body : document.querySelector(targetId);
        if (!target) return;
        
        e.preventDefault();

        if (lenis) {
          lenis.scrollTo(targetId === '#top' ? 0 : target, { duration: 1.2 });
          return;
        }
        
        const startY = window.scrollY || window.pageYOffset;
        const targetY = target.getBoundingClientRect().top + startY;
        const distance = targetY - startY;
        const duration = 1200; // 1.2 segundos para uma sensação incrivelmente fluida
        let startTime = null;

        function animation(currentTime) {
          if (startTime === null) startTime = currentTime;
          const timeElapsed = currentTime - startTime;
          const progress = Math.min(timeElapsed / duration, 1);
          
          // Applica o cálculo matemático de suavidade
          window.scrollTo(0, startY + (distance * ease(progress)));
          
          if (timeElapsed < duration) {
            requestAnimationFrame(animation);
          }
        }
        
        requestAnimationFrame(animation);
      });
    });
  }

  function initFormValidation() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const successMsg = form
        .closest('.contact-form')
        ?.querySelector('.success-message');
      const errorMsg = form
        .closest('.contact-form')
        ?.querySelector('.error-message');

      const name = form.querySelector('#name')?.value?.trim();
      const email = form.querySelector('#email')?.value?.trim();
      const message = form.querySelector('#Message')?.value?.trim();

      if (!name || !email || !message) {
        if (errorMsg) {
          errorMsg.style.display = 'block';
          errorMsg.textContent = 'Por favor, preencha todos os campos.';
        }
        return;
      }
      form.style.display = 'none';
      if (successMsg) successMsg.style.display = 'block';
    });
  }

  function initAwardHover() {
    const rows = document.querySelectorAll('.award-row');
    rows.forEach((row) => {
      const bg = row.querySelector('.award-background');
      if (!bg) return;

      row.addEventListener('mouseenter', () => {
        bg.style.transform = 'scaleY(1)';
        bg.style.transition = 'transform 0.4s cubic-bezier(0.65, 0, 0.35, 1)';
        row.style.color = 'var(--color--white)';
        row.style.transition = 'color 0.3s';
      });

      row.addEventListener('mouseleave', () => {
        bg.style.transform = 'scaleY(0)';
        row.style.color = 'var(--color--primary)';
      });
    });
  }



  // Saída do hero: publica o progresso da rolagem como variáveis CSS (--p de 0 a 1, --y em px);
  // o CSS do hero decide o que fazer com elas
  function initHeroScroll() {
    const hero = document.querySelector('.ds-hero');
    if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const h = hero.offsetHeight || 1;
      const y = Math.min(Math.max(window.scrollY, 0), h);
      hero.style.setProperty('--p', (y / h).toFixed(4));
      hero.style.setProperty('--y', y + 'px');
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function injectRevealStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .revealed {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    initLenis();
    injectRevealStyle();
    initScrollReveal();
    initNavHighlight();
    initNavFlip();
    initButtonFlip();
    initLightbox();
    initSmoothScroll();
    initFormValidation();
    initAwardHover();
    initHeroScroll();
    initHeadingReveal();
    initWordScroll();
    initPortrait();
    initTypeHeading();
    initCards();
    initTerminal();
    initCursor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
