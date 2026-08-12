/* ═══════════════════════════════════════════════════════════
   Element Concept — лендинг курса. Только UI-поведение.
   Вся прокрутка обслуживается одним rAF-циклом: слушатель
   scroll лишь поднимает флаг, чтение layout — раз в кадр.
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

  /* ─── Разбивка заголовков на слова ─────────────────────── */
  /* Каждое слово — маска с внутренним <i>, который выезжает снизу.
     Разметку переписываем до первой отрисовки, иначе будет мигание. */
  const split = el => {
    const out = document.createDocumentFragment();
    const chars = el.dataset.split === 'chars';
    let n = 0;

    el.childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
        out.appendChild(node.cloneNode());
        return;
      }
      // Вложенные теги (.dot, .cover__h-sm) анимируем целиком, не разбирая.
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Блочные вставки получают маску во всю строку, а не инлайновую.
        const block = node.hasAttribute('data-block');
        // Точка приклеена к предыдущему слову — пробел перед ней убираем.
        if (node.classList.contains('dot') && out.lastChild &&
            out.lastChild.nodeType === Node.TEXT_NODE) {
          out.removeChild(out.lastChild);
        }
        const wrap = document.createElement('span');
        wrap.className = block ? 'w w--b' : 'w';
        const inner = document.createElement('i');
        inner.style.setProperty('--wd', `${n++ * 42}ms`);
        inner.appendChild(node.cloneNode(true));
        wrap.appendChild(inner);
        out.appendChild(wrap);
        if (!block) out.appendChild(document.createTextNode(' '));
        return;
      }
      (node.textContent.match(/\S+/g) || []).forEach(word => {
        // chars — маска на каждую букву; слово остаётся неразрывным блоком,
        // иначе перенос строки рвёт его посреди символов.
        if (chars) {
          const group = document.createElement('span');
          group.className = 'wg';
          [...word].forEach(ch => {
            const wrap = document.createElement('span');
            wrap.className = 'w';
            const inner = document.createElement('i');
            inner.textContent = ch;
            inner.style.setProperty('--wd', `${n++ * 17}ms`);
            wrap.appendChild(inner);
            group.appendChild(wrap);
          });
          out.appendChild(group);
          out.appendChild(document.createTextNode(' '));
          return;
        }
        const wrap = document.createElement('span');
        wrap.className = 'w';
        const inner = document.createElement('i');
        inner.textContent = word;
        inner.style.setProperty('--wd', `${n++ * 42}ms`);
        wrap.appendChild(inner);
        out.appendChild(wrap);
        out.appendChild(document.createTextNode(' '));
      });
    });

    el.replaceChildren(out);
    el.classList.add('is-split');
  };

  /* Заголовок первого экрана разбираем сразу — он скрыт до разбора, и без
     этого браузеру нечего рисовать. Остальные девять ждут первой отрисовки:
     до неё каждая лишняя перестройка DOM — это пустой экран у зрителя. */
  const splitTargets = [...document.querySelectorAll('[data-split]')];
  const above = splitTargets.filter(el => el.closest('.cover'));
  above.forEach(split);

  /* ─── Текст, загорающийся по мере прокрутки ────────────── */
  let hlTargets = [];
  const initHl = () => {
    hlTargets = [...document.querySelectorAll('[data-hl]')].map(el => {
      const frag = document.createDocumentFragment();
      (el.textContent.match(/\S+/g) || []).forEach(word => {
        const s = document.createElement('span');
        s.className = 'hl';
        s.textContent = word;
        frag.appendChild(s);
        frag.appendChild(document.createTextNode(' '));
      });
      el.replaceChildren(frag);
      return { el, words: [...el.querySelectorAll('.hl')] };
    });
  };

  /* ─── Одноразовые появления ────────────────────────────── */
  /* Наблюдатели заводятся не сразу, а после прелоадера: иначе всё, что
     попало в первый экран, доигрывает под шторкой и выезжает уже готовым. */
  const revealables = document.querySelectorAll('.rv, .mask, [data-split]');

  const startReveals = () => {
    if (calm || !('IntersectionObserver' in window)) {
      revealables.forEach(el => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        obs.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach(el => io.observe(el));
  };

  /* ─── Счётчики ─────────────────────────────────────────── */
  const runCount = el => {
    const to = +el.dataset.count;
    const prefix = el.dataset.prefix || '';
    const group = 'group' in el.dataset;
    const fmt = v => prefix + (group ? v.toLocaleString('ru-RU') : String(v));

    if (calm || to === 0) { el.textContent = fmt(to); return; }

    const dur = 1100 + Math.min(to, 60000) / 60000 * 600;
    const t0 = performance.now();
    const tick = now => {
      const p = clamp01((now - t0) / dur);
      // easeOutExpo — быстрый разгон и мягкая доводка до финального числа
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = fmt(Math.round(to * e));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const counters = document.querySelectorAll('[data-count]');
  const startCounters = () => {
    if (!('IntersectionObserver' in window)) { counters.forEach(runCount); return; }
    const cio = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        runCount(e.target);
        obs.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => cio.observe(el));
  };

  /* ─── Общий цикл прокрутки ─────────────────────────────── */
  // Полосу прогресса ведёт CSS scroll-таймлайн, если он поддерживается.
  const cssTimeline = CSS.supports('animation-timeline', 'scroll()');
  const progress = cssTimeline ? null : document.querySelector('.prog-line i');
  const bar = document.querySelector('.bar');
  /* Параллакс двигаем на <img> через --py, а шторка кадра живёт на <picture>:
     так две анимации не спорят за одно свойство transform. */
  const parallax = [...document.querySelectorAll('[data-par]')].map(el => {
    const amount = parseFloat(el.dataset.par) || 0.1;
    // Запас масштаба задаётся отдельно: в сетке из нескольких кадров нужен
    // общий зум, иначе соседние карточки выглядят по-разному в покое.
    const zoom = parseFloat(el.dataset.parZoom) || amount;
    const img = el.querySelector('img');
    if (img) img.style.setProperty('--pz', 1 + zoom);
    return { el, img, amount: Math.min(amount, zoom) };
  }).filter(p => p.img);

  let ticking = false;
  let lastY = scrollY;
  let barHidden = false;
  let scrollVel = 0;   // px за кадр прокрутки — им подкручивается бегущая строка
  let scrollDir = 1;

  const frame = () => {
    ticking = false;
    const y = scrollY;
    const vh = innerHeight;

    if (progress) {
      const max = document.body.scrollHeight - vh;
      progress.style.transform = `scaleX(${max > 0 ? clamp01(y / max) : 0})`;
    }

    const delta = y - lastY;
    if (delta) scrollDir = delta > 0 ? 1 : -1;
    scrollVel = Math.max(scrollVel, Math.min(Math.abs(delta), 90));

    // Шапка прячется при движении вниз и возвращается при первом движении вверх.
    if (bar) {
      const should = delta > 0 && y > 260;
      if (should !== barHidden) {
        barHidden = should;
        bar.classList.toggle('is-hidden', should);
      }
    }
    lastY = y;

    if (calm) return;

    /* Сначала читаем всю геометрию, потом пишем стили: чередование чтения
       и записи заставляет браузер пересчитывать лейаут на каждой итерации. */
    const writes = [];

    parallax.forEach(({ el, img, amount }) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      // -1 над экраном … +1 под экраном; сдвиг вдвое меньше запаса масштаба
      const p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
      const py = `${(p * amount * r.height * 0.5).toFixed(1)}px`;
      writes.push(() => img.style.setProperty('--py', py));
    });

    hlTargets.forEach(({ el, words }) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      // Прогресс — пока блок идёт от нижней трети к верхней трети экрана.
      const p = clamp01((vh * 0.78 - r.top) / (vh * 0.5 + r.height * 0.5));
      const reach = p * (words.length + 6);
      words.forEach((w, i) => {
        // Ниже .45 не опускаемся: это порог читаемости на тёмном фоне.
        const o = (0.45 + 0.55 * clamp01((reach - i) / 5)).toFixed(3);
        writes.push(() => w.style.setProperty('--o', o));
      });
    });

    writes.forEach(fn => fn());
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* ─── Вторая фаза ──────────────────────────────────────── */
  /* Всё, что не нужно для первого кадра: разбор остальных заголовков,
     наблюдатели, бегущая строка, барабаны, обработчики. Запускается после
     первой отрисовки — до неё эта работа держала бы экран пустым. */
  const initRest = () => {
    splitTargets.filter(el => !above.includes(el)).forEach(split);
    initHl();
    startReveals();
    startCounters();

    /* ─── Непрерывный цикл: бегущая строка и наклон по инерции ─ */
    const mq = document.querySelector('.mq');
    const mqRow = mq && mq.querySelector('.mq__row');
    const skewed = [...document.querySelectorAll('[data-skew]')];

    if (!calm && (mqRow || skewed.length)) {
      /* Строку дублируем до двойной ширины экрана и крутим по модулю половины —
         шов не виден. Прокрутка добавляет скорость и разворачивает движение. */
      let half = 0;
      let fill = () => {};
      if (mqRow) {
        const original = [...mqRow.children].map(n => n.cloneNode(true));
        const setW = mqRow.scrollWidth;   // ширина одного набора, меряем один раз
        fill = () => {
          // Считаем число копий заранее: цикл с чтением scrollWidth на каждой
          // итерации дёргал бы пересчёт лейаута столько же раз.
          const need = Math.max(2, Math.ceil((mq.clientWidth * 2) / setW) + 1);
          const have = mqRow.children.length / original.length;
          const frag = document.createDocumentFragment();
          for (let i = have; i < need; i++) {
            original.forEach(n => frag.appendChild(n.cloneNode(true)));
          }
          mqRow.appendChild(frag);
          half = mqRow.scrollWidth / 2;
        };
        fill();
        addEventListener('resize', fill);
      }

      let offset = 0;
      let boost = 0;
      let skew = 0;
      let prev = 0;
      let mqOn = !!mqRow;
      let raf = 0;

      const loop = now => {
        const dt = prev ? Math.min(now - prev, 50) : 16.7;
        prev = now;
        const k = dt / 16.7;

        // Импульс прокрутки затухает сам: scrollVel обнуляется, как только
        // события scroll прекращаются, а boost плавно сходит к нулю.
        boost += (scrollVel - boost) * 0.12 * k;
        scrollVel *= 0.86;

        if (mqRow && mqOn && half) {
          offset = (offset + (0.55 + boost * 0.5) * scrollDir * k + half) % half;
          mqRow.style.transform = `translate3d(${-offset.toFixed(2)}px,0,0)`;
        }

        if (skewed.length) {
          const target = Math.max(-2.2, Math.min(2.2, boost * scrollDir * 0.05));
          skew += (target - skew) * 0.15 * k;
          const v = Math.abs(skew) < 0.01 ? 0 : skew;
          skewed.forEach(el => el.style.setProperty('--skew', `${v.toFixed(3)}deg`));
        }

        const idle = boost < 0.05 && Math.abs(skew) < 0.01 && !mqOn;
        raf = idle ? 0 : requestAnimationFrame(loop);
      };

      const kick = () => { if (!raf) { prev = 0; raf = requestAnimationFrame(loop); } };

      if (mq && 'IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { mqOn = e.isIntersecting; kick(); },
          { threshold: 0 }).observe(mq);
      }
      addEventListener('scroll', kick, { passive: true });
      kick();
    }

    /* ─── Магнитные кнопки ─────────────────────────────────── */
    if (fine && !calm) {
      document.querySelectorAll('[data-mag]').forEach(el => {
        let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
        const run = () => {
          cx = lerp(cx, tx, 0.18);
          cy = lerp(cy, ty, 0.18);
          el.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
          raf = Math.abs(cx - tx) > 0.1 || Math.abs(cy - ty) > 0.1 ? requestAnimationFrame(run) : 0;
        };
        const kick = () => { if (!raf) raf = requestAnimationFrame(run); };

        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          tx = (e.clientX - (r.left + r.width / 2)) * 0.22;
          ty = (e.clientY - (r.top + r.height / 2)) * 0.32;
          kick();
        });
        el.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
      });
    }

    /* ─── Наклон карточек за указателем ────────────────────── */
    if (fine && !calm) {
      document.querySelectorAll('[data-tilt]').forEach(el => {
        const set = (rx, ry) => {
          el.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
          el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        };
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          // −1…1 от центра карточки по каждой оси
          set(((r.top + r.height / 2 - e.clientY) / r.height) * 2.6,
              ((e.clientX - r.left - r.width / 2) / r.width) * 2.6);
        });
        el.addEventListener('pointerleave', () => set(0, 0));
      });
    }

    /* ─── Барабаны разрядов в цене ─────────────────────────── */
    /* Каждая цифра — вертикальная лента 0…9, которая доезжает до нужной.
       Ширина ленты фиксирована табличными цифрами, поэтому вёрстка не прыгает. */
    const reel = document.querySelector('[data-reel]');
    if (reel) {
      const digits = [...reel.dataset.reel];
      reel.textContent = '';
      reel.setAttribute('aria-label', reel.dataset.reelLabel || reel.dataset.reel);

      const cells = digits.map((ch, i) => {
        if (!/\d/.test(ch)) {
          const gap = document.createElement('i');
          gap.className = 'reel__gap';
          gap.textContent = ch === ' ' ? ' ' : ch;
          reel.appendChild(gap);
          return null;
        }
        const cell = document.createElement('i');
        cell.className = 'reel__d';
        const strip = document.createElement('b');
        // Две ленты подряд: цель value+10 — это полный оборот и лишь потом цифра.
        strip.textContent = '01234567890123456789'.split('').join('\n');
        cell.appendChild(strip);
        cell.style.setProperty('--wd', `${i * 45}ms`);
        reel.appendChild(cell);
        return { strip, value: +ch };
      }).filter(Boolean);

      const spin = () => cells.forEach(({ strip, value }) => {
        strip.style.setProperty('--to', calm ? value : value + 10);
      });

      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(([e], obs) => {
          if (!e.isIntersecting) return;
          spin();
          obs.disconnect();
        }, { threshold: 0.5 });
        io.observe(reel);
      } else {
        spin();
      }
    }

    /* ─── Вопросы ──────────────────────────────────────────── */
    document.querySelectorAll('.qa__bar').forEach(b => {
      b.addEventListener('click', () => {
        const open = b.closest('.qa').classList.toggle('is-open');
        b.setAttribute('aria-expanded', String(open));
      });
    });

    /* ─── Мобильное меню ───────────────────────────────────── */
    const burger = document.querySelector('.burger');
    const menu = document.getElementById('menu');
    if (burger && menu) {
      const setMenu = open => {
        menu.hidden = !open;
        burger.setAttribute('aria-expanded', String(open));
      };
      burger.addEventListener('click', () => setMenu(menu.hidden));
      menu.addEventListener('click', e => { if (e.target.tagName === 'A') setMenu(false); });
      addEventListener('resize', () => { if (innerWidth > 900) setMenu(false); });
    }

    /* ─── Липкая полоса с ценой ────────────────────────────── */
    const dock = document.querySelector('.dock');
    const cover = document.querySelector('.cover');
    const form = document.getElementById('form');
    if (dock && cover && form && 'IntersectionObserver' in window) {
      dock.hidden = false;
      const state = { past: false, atForm: false };
      const sync = () => dock.classList.toggle('is-on', state.past && !state.atForm);
      new IntersectionObserver(([e]) => {
        state.past = !e.isIntersecting && e.boundingClientRect.top < 0;
        sync();
      }, { threshold: 0 }).observe(cover);
      new IntersectionObserver(([e]) => {
        state.atForm = e.isIntersecting;
        sync();
      }, { threshold: 0 }).observe(form);
    }

    onScroll();
  };

  /* Первый экран заводим сразу, остальное — следующим кадром.
     Таймер продублирован не зря: в фоновой вкладке requestAnimationFrame не
     вызывается вовсе, и без него страница осталась бы неинициализированной. */
  const once = fn => { let done = false; return () => { if (!done) { done = true; fn(); } }; };

  const showCover = once(() => {
    document.querySelectorAll('.cover .rv, .cover .mask, .cover [data-split]')
      .forEach(el => el.classList.add('is-in'));
  });
  const startRest = once(initRest);

  requestAnimationFrame(() => {
    showCover();
    requestAnimationFrame(() => setTimeout(startRest, 0));
  });
  setTimeout(showCover, 120);
  setTimeout(startRest, 400);
})();
