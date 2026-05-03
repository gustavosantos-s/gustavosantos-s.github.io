(function () {
  'use strict';

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
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
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
      document.body.appendChild(wrapper);
    });

    projectLinks.forEach((link, index) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const wrapper = lightboxWrappers[index];
        if (wrapper) {
          wrapper.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          requestAnimationFrame(() => {
            wrapper.style.opacity = '1';
          });
        }
      });
    });

    function closeLightbox(wrapper) {
      if (!wrapper) return;
      wrapper.style.opacity = '0';
      document.body.style.overflow = '';
      setTimeout(() => {
        wrapper.style.display = 'none';
      }, 300);
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
    injectRevealStyle();
    initScrollReveal();
    initNavHighlight();
    initNavFlip();
    initButtonFlip();
    initLightbox();
    initSmoothScroll();
    initFormValidation();
    initAwardHover();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
