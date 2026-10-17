const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Страница показывается не сразу: сначала шапка, потом (когда загрузятся стили
// и шрифты) всё остальное — см. начало страниц. Анимации появления запускаем
// только после этого, иначе они отыграют незаметно
function whenPageShown(fn) {
    const root = document.documentElement;
    const shown = () => root.classList.contains('css-ready') && !root.classList.contains('fonts-wait');
    if (shown()) return fn();
    const watcher = new MutationObserver(() => {
        if (!shown()) return;
        watcher.disconnect();
        fn();
    });
    watcher.observe(root, { attributes: true, attributeFilter: ['class'] });
}

// ===== Появление блоков при прокрутке =====

if ('IntersectionObserver' in window && !reduceMotion) {
    document.documentElement.classList.add('js');

    const targets = document.querySelectorAll(
        '.section h2, .section-lead, .card, .works-grid a, .gallery-item, .contact-list, .about-text, .gallery-more, .more'
    );

    targets.forEach((el) => {
        el.classList.add('reveal');
        // Соседи в сетке появляются «волной», по 4 в ряд
        const position = Array.from(el.parentElement.children).indexOf(el) % 4;
        if (position > 0) el.style.transitionDelay = (position * 90) + 'ms';
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add('visible');
            observer.unobserve(el);
            // После появления убираем задержку, чтобы наведение срабатывало сразу
            el.addEventListener('transitionend', () => {
                el.style.transitionDelay = '';
            }, { once: true });
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    whenPageShown(() => targets.forEach((el) => observer.observe(el)));
}

// ===== Шапка при прокрутке и плавающая кнопка звонка =====

const header = document.querySelector('.site-header');
const callFab = document.querySelector('.call-fab');
let scrollTicking = false;

function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 10);
    if (callFab) callFab.classList.toggle('show', y > 480);
    scrollTicking = false;
}

window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(onScroll);
    }
}, { passive: true });
onScroll();

// ===== Меню на телефонах =====

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('site-nav');

if (menuToggle && nav) {
    const desktop = window.matchMedia('(min-width: 641px)');

    // Затемнение страницы под открытым меню
    const backdrop = document.createElement('div');
    backdrop.className = 'menu-backdrop';
    document.body.appendChild(backdrop);

    function setMenuOpen(open) {
        nav.classList.toggle('open', open);
        document.body.classList.toggle('menu-open', open);
        menuToggle.setAttribute('aria-expanded', String(open));
        menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    }

    const toggleMenu = () => setMenuOpen(!nav.classList.contains('open'));

    // Переключаем меню в момент, когда палец или кнопку мыши отпустили.
    // Событие click браузеры иногда «съедают» при быстрых нажатиях подряд
    // (принимают их за двойной тап), а pointerup приходит всегда.
    let lastPointerToggle = 0;
    menuToggle.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
        lastPointerToggle = performance.now();
        toggleMenu();
    });

    // click остаётся для клавиатуры (Enter, пробел); клик сразу после
    // pointerup пропускаем, чтобы меню не переключилось дважды
    menuToggle.addEventListener('click', () => {
        if (performance.now() - lastPointerToggle < 700) return;
        toggleMenu();
    });

    // Закрываем меню после выбора пункта (важно для ссылки «Контакты» на той же странице)
    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuOpen(false)));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && nav.classList.contains('open')) {
            setMenuOpen(false);
            menuToggle.focus();
        }
    });

    // Клик мимо меню закрывает его
    document.addEventListener('click', (e) => {
        if (nav.classList.contains('open') && !nav.contains(e.target) && !menuToggle.contains(e.target)) {
            setMenuOpen(false);
        }
    });

    // Если окно расширили до компьютерного размера — мобильное меню закрываем
    desktop.addEventListener('change', (e) => {
        if (e.matches) setMenuOpen(false);
    });
}

// Просмотр фото в галерее на весь экран

const lightbox = document.querySelector('.lightbox');

if (lightbox) {
    const items = Array.from(document.querySelectorAll('.gallery-item'));
    const img = lightbox.querySelector('.lightbox-img');
    const caption = lightbox.querySelector('.lightbox-caption');
    const counter = lightbox.querySelector('.lightbox-counter');
    let current = 0;

    const placeholder = lightbox.querySelector('.lightbox-placeholder');
    const frame = lightbox.querySelector('.lightbox-frame');
    let pendingAlt = '';

    // Настоящее фото загрузилось — плавно проявляем его поверх размытой копии.
    // Описание (alt) ставим только теперь, иначе браузер на миг покажет его текстом
    // Ждём ещё и декодирования, иначе на слабом компьютере
    // большое фото прорисуется полосами уже после исчезновения размытия
    img.addEventListener('load', () => {
        const src = img.currentSrc;
        const reveal = () => {
            if (img.currentSrc !== src) return; // пока ждали, уже листнули дальше
            img.alt = pendingAlt;
            img.classList.add('loaded');
        };
        img.decode().then(reveal, reveal);
    });

    // На весь экран показываем большое фото: на телефоне хватает 1080 px,
    // на компьютере браузер возьмёт оригинал 1920 px
    img.sizes = '(max-width: 900px) 100vw, 75vh';

    function show(index) {
        current = (index + items.length) % items.length;
        const item = items[current];
        const thumb = item.querySelector('img');
        const full = item.dataset.full;

        // Рамка принимает форму фото (пропорции берём у миниатюры в сетке)
        const ratio = thumb.naturalWidth && thumb.naturalHeight
            ? thumb.naturalWidth / thumb.naturalHeight
            : thumb.width / thumb.height || 1;
        frame.style.setProperty('--ratio', ratio);

        // Размытая крошечная копия видна сразу — она уже встроена в страницу
        placeholder.src = item.dataset.placeholder;

        // Прежнее фото убираем мгновенно, без затухания
        img.style.transition = 'none';
        img.classList.remove('loaded');
        void img.offsetWidth;
        img.style.transition = '';

        pendingAlt = thumb.alt;
        if (img.getAttribute('src') === full) {
            // То же фото — событие load не придёт, показываем сразу
            requestAnimationFrame(() => {
                img.alt = pendingAlt;
                img.classList.add('loaded');
            });
        } else {
            img.alt = '';
            img.srcset = item.dataset.medium + ' 1080w, ' + full + ' 1920w';
            img.src = full;
        }
        caption.textContent = thumb.alt;
        counter.textContent = (current + 1) + ' / ' + items.length;
    }

    items.forEach((item, index) => {
        item.addEventListener('click', () => {
            show(index);
            lightbox.showModal();
        });
    });

    lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
    lightbox.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
    lightbox.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));

    // Клик по тёмному фону закрывает просмотр
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-figure')) {
            lightbox.close();
        }
    });

    lightbox.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') show(current - 1);
        if (e.key === 'ArrowRight') show(current + 1);
    });

    // Листание свайпом на телефоне
    let touchStartX = null;
    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
        if (touchStartX === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
        touchStartX = null;
    });

    lightbox.addEventListener('close', () => {
        // Очищаем просмотр, чтобы при следующем открытии
        // не мелькнуло предыдущее фото
        img.classList.remove('loaded');
        img.removeAttribute('srcset');
        img.removeAttribute('src');
        img.alt = '';
        placeholder.removeAttribute('src');
        // Возвращаем фокус на фото, с которого открыли
        items[current].focus();
    });
}
