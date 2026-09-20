document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-window]').forEach(link => {
        link.addEventListener('click', () => {
            sessionStorage.setItem('roar_migration_window', link.dataset.window);
        });
    });

    const sections = [...document.querySelectorAll('.timeline-step')];
    const monthLinks = [...document.querySelectorAll('.month-jump a')];
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            monthLinks.forEach(link => {
                const active = link.getAttribute('href') === `#${entry.target.id}`;
                link.style.background = active ? '#151d16' : '';
                link.style.color = active ? '#fff' : '';
            });
        });
    }, { rootMargin: '-35% 0px -55%' });
    sections.forEach(section => observer.observe(section));
});
