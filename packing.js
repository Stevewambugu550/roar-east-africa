document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = [...document.querySelectorAll('.packing-list input[type="checkbox"]')];
    const count = document.getElementById('packingCount');
    const progress = document.getElementById('packingProgress');
    const storageKey = 'roar_packing_checklist';

    function loadState() {
        let saved = [];
        try { saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch {}
        const packed = new Set(saved);
        checkboxes.forEach(box => { box.checked = packed.has(box.dataset.item); });
    }

    function updateProgress(save = true) {
        const packed = checkboxes.filter(box => box.checked).map(box => box.dataset.item);
        count.textContent = `${packed.length} of ${checkboxes.length} packed`;
        progress.style.width = `${checkboxes.length ? packed.length / checkboxes.length * 100 : 0}%`;
        if (save) localStorage.setItem(storageKey, JSON.stringify(packed));
    }

    checkboxes.forEach(box => box.addEventListener('change', () => updateProgress()));
    document.getElementById('resetPacking')?.addEventListener('click', () => {
        checkboxes.forEach(box => { box.checked = false; });
        updateProgress();
    });

    loadState();
    updateProgress(false);
});
