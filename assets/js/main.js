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
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
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
    const headings = document.querySelectorAll('.heading-medium');
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

  // Cards de "Como eu trabalho": entram em cascata e têm um brilho que segue o mouse
  function initCards() {
    const cards = document.querySelectorAll('.metrics-grid .metric-card');
    cards.forEach((card, i) => {
      card.style.setProperty('--i', i % 3);
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', e.clientX - r.left + 'px');
        card.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
    onceVisible(cards, (c) => c.classList.add('is-revealed'), { threshold: 0.15 });
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
    initCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
