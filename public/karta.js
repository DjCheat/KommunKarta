// karta.js

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================

// Skapa toast-container om den inte finns
function getToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

// Visa en toast-notifiering
function showToast(message, type = 'info', duration = 3000) {
    const container = getToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Ikon baserat på typ
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Stäng">×</button>
    `;

    // Stäng-knapp funktionalitet
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
    });

    // Auto-ta bort efter duration
    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}

// Ta bort en toast med animation
function removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

// ============================================
// LOADING STATE HELPERS
// ============================================

function setButtonLoading(button, isLoading, originalText = null) {
    if (!button) return;

    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.disabled = true;
        button.classList.add('btn-loading');
        button.innerHTML = '<span class="spinner"></span> Laddar...';
    } else {
        button.disabled = false;
        button.classList.remove('btn-loading');
        button.textContent = originalText || button.dataset.originalText || 'Klar';
        delete button.dataset.originalText;
    }
}

// ============================================
// SELECTION COUNTER
// ============================================

function updateSelectionCounter() {
    const checkboxes = document.querySelectorAll('#checkbox-list input[type="checkbox"]');
    const checked = document.querySelectorAll('#checkbox-list input[type="checkbox"]:checked');
    const totalCount = checkboxes.length;
    const checkedCount = checked.length;
    const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

    // Uppdatera statistik-overlay på kartan
    const statsText = document.getElementById('stats-text');
    if (statsText) {
        statsText.textContent = `Markerade: ${checkedCount} av ${totalCount} (${percentage}%)`;
    }
}

// ============================================
// MAIN APPLICATION CODE
// ============================================

// Hämta element
const svgMap = document.getElementById('sweden-map');
const checkboxList = document.getElementById('checkbox-list');
const tooltip = document.getElementById('map-tooltip');
const kommunSearchInput = document.getElementById('kommun-search');
const searchCountSpan = document.getElementById('search-count');
const sortSelect = document.getElementById('sort-select');

// Global Data Store
let allKommunData = {};
let allRegionData = {}; // För att cachea län/regioner
let globalKommunerMap = {}; // För att komma åt kommun-namn globalt

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }
}

// Asynkron initialisering av kartan
async function initializeMap() {
    try {
        initTheme();

        // Hämta kommun-data och SVG parallellt
        const [kommunResponse, svgResponse] = await Promise.all([
            fetch('kommuner.json'),
            fetch('kommunKarta.svg')
        ]);

        if (!kommunResponse.ok || !svgResponse.ok) {
            throw new Error('Kunde inte ladda kartdata');
        }

        const data = await kommunResponse.json();
        const svgData = await svgResponse.text();

        // Spara data globalt för sökning etc.
        allKommunData = data;

        const regions = {};
        const kommuner = {};

        Object.keys(data).forEach(key => {
            if (key.length === 2 && !isNaN(key)) {
                regions[key] = { name: data[key], code: key, kommuner: [] };
            } else if (key.length === 4 && !isNaN(key)) {
                let regionCode = key.substring(0, 2);
                kommuner[key] = { name: data[key], code: key, regionCode: regionCode };
            }
        });

        // Koppla kommuner till regioner
        Object.values(kommuner).forEach(kommun => {
            if (regions[kommun.regionCode]) {
                regions[kommun.regionCode].kommuner.push(kommun);
            }
        });

        allRegionData = regions;
        globalKommunerMap = kommuner;

        // Lägg till SVG-filen i dokumentet
        svgMap.innerHTML = svgData;

        // Rensa bort hårdkodade färger från SVG:n så att CSS kan styra
        svgMap.querySelectorAll('path, polygon').forEach(el => {
            el.style.fill = '';
            // Vi behåller stroke men låter CSS styra färgen
        });

        // Rendera Lista baserat på sortering (standard: region)
        renderCheckboxListBasedOnSort();

        // Koppla händelselyssnare för tooltip och hover
        setupMapInteractions(kommuner);

        // Setup Sök
        setupSearch(kommuner, regions);

        // Setup Spara/Öppna fil
        setupJsonExportImport();

        // Setup Hjälp-system
        setupHelpSystem();

        // Läs in senaste kartvyn
        restoreCheckboxState();

        // Initiera färgväljaren
        updateSelectedColor(KOMMUN_COLOR_SELECTED, true);

        // Initial count update
        updateSelectionCounter();
        centerMapInContainer();

        // Kolla efter delad länk (URL parametrar)
        parseShareParams();

    } catch (error) {
        console.error('Fel vid initialisering av kartan:', error);
        showToast('Kunde inte ladda kartan. Försök ladda om sidan.', 'error', 5000);
    }
}

function renderGroupedCheckboxList(regions) {
    checkboxList.innerHTML = '';

    // Sortera regioner på namn
    const sortedRegions = Object.values(regions).sort((a, b) => a.name.localeCompare(b.name, 'sv'));

    sortedRegions.forEach(region => {
        // Skapa container för länet
        const regionContainer = document.createElement('div');
        regionContainer.className = 'region-group';
        regionContainer.dataset.regionCode = region.code;
        regionContainer.style.display = 'flex';
        regionContainer.style.flexDirection = 'column';
        regionContainer.style.gap = '4px';
        regionContainer.style.minWidth = '200px';

        // Header
        const header = document.createElement('div');
        header.className = 'list-group-header';
        header.innerHTML = `
            <label class="region-header-label">
                <input type="checkbox" class="group-toggle-checkbox" data-region="${region.code}" title="Markera/avmarkera hela länet">
                <span>${region.name}</span>
            </label>
        `;

        // Koppla event för "Markera hela länet"
        header.querySelector('.group-toggle-checkbox').addEventListener('change', (e) => {
            toggleRegion(region.code, e.target);
        });

        regionContainer.appendChild(header);

        // Sortera kommuner i länet
        region.kommuner.sort((a, b) => a.name.localeCompare(b.name, 'sv'));

        region.kommuner.forEach(kommun => {
            const label = createCheckboxItem(kommun.code, kommun.name);
            regionContainer.appendChild(label);
        });

        const listColumn = document.createElement('div');
        listColumn.className = 'checkbox-column';
        listColumn.appendChild(regionContainer);

        checkboxList.appendChild(listColumn);
    });
}

// Render Checkbox List based on Sort Select
function renderCheckboxListBasedOnSort() {
    const sortMode = sortSelect ? sortSelect.value : 'region';

    if (sortMode === 'region') {
        renderGroupedCheckboxList(allRegionData);
    } else {
        renderFlatCheckboxList(allKommunData);
    }

    // Använd sökfilter om det finns något
    if (kommunSearchInput && kommunSearchInput.value) {
        kommunSearchInput.dispatchEvent(new Event('input'));
    }

    // Återställ checked state
    restoreCheckboxState();
}

function renderFlatCheckboxList(data) {
    checkboxList.innerHTML = '';

    const kommunKoder = Object.keys(data).filter(k => k.length === 4); // Endast kommuner
    // Sortera A-Ö
    kommunKoder.sort((a, b) => {
        const nameA = data[a];
        const nameB = data[b];
        return nameA.localeCompare(nameB, 'sv');
    });

    const listColumn = document.createElement('div');
    listColumn.className = 'checkbox-column flat-list';
    listColumn.style.width = '100%';

    kommunKoder.forEach(code => {
        const item = createCheckboxItem(code, data[code]);
        listColumn.appendChild(item);
    });

    checkboxList.appendChild(listColumn);
}

// Render Checkbox List based on Sort Select
function renderCheckboxListBasedOnSort() {
    const sortMode = sortSelect ? sortSelect.value : 'region';

    if (sortMode === 'region') {
        renderGroupedCheckboxList(allRegionData);
    } else {
        renderFlatCheckboxList(allKommunData);
    }

    // Använd sökfilter om det finns något
    if (kommunSearchInput && kommunSearchInput.value) {
        kommunSearchInput.dispatchEvent(new Event('input'));
    }

    // Återställ checked state
    restoreCheckboxState();
}

function renderFlatCheckboxList(data) {
    checkboxList.innerHTML = '';

    const kommunKoder = Object.keys(data).filter(k => k.length === 4); // Endast kommuner
    // Sortera A-Ö
    kommunKoder.sort((a, b) => {
        const nameA = data[a];
        const nameB = data[b];
        return nameA.localeCompare(nameB, 'sv');
    });

    const listColumn = document.createElement('div');
    listColumn.className = 'checkbox-column flat-list';
    listColumn.style.width = '100%';

    kommunKoder.forEach(code => {
        const item = createCheckboxItem(code, data[code]);
        listColumn.appendChild(item);
    });

    checkboxList.appendChild(listColumn);
}

function createCheckboxItem(code, name) {
    const checkboxId = 'cb-' + code;
    const label = document.createElement('label');
    label.htmlFor = checkboxId;
    label.dataset.kommunName = name.toLowerCase(); // För sök
    label.dataset.kommunCode = code;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = code;
    checkbox.id = checkboxId;
    checkbox.addEventListener('change', toggleKommunColor);

    label.addEventListener('mouseenter', () => {
        const paths = document.querySelectorAll(`[id="${code}"] polygon, [id="${code}"] path, path[id="${code}"], polygon[id="${code}"]`);
        paths.forEach(p => p.style.opacity = '0.5');
    });

    label.addEventListener('mouseleave', () => {
        const paths = document.querySelectorAll(`[id="${code}"] polygon, [id="${code}"] path, path[id="${code}"], polygon[id="${code}"]`);
        paths.forEach(p => p.style.opacity = '1');
    });

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(name));
    return label;
}

function toggleRegion(regionCode, checkbox) {
    // Hämta alla kommuner i regionen
    const inputs = document.querySelectorAll(`.region-group[data-region-code="${regionCode}"] input[type="checkbox"]`);
    const newState = checkbox.checked;

    inputs.forEach(input => {
        if (input.checked !== newState) {
            input.checked = newState;
            const event = new Event('change');
            input.dispatchEvent(event);
        }
    });
}

function restoreCheckboxState() {
    const savedCheckboxState = JSON.parse(localStorage.getItem('checkboxState')) || {};
    Object.keys(savedCheckboxState).forEach(kommunKod => {
        if (savedCheckboxState[kommunKod]) {
            const cb = document.getElementById('cb-' + kommunKod);
            if (cb) {
                cb.checked = true;
                toggleKommunColor({ target: cb });
            }
        }
    });
}

// Starta initialiseringen
initializeMap();


// Färger för kommuner (matchar CSS-variabler)
const DEFAULT_KOMMUN_COLOR = '#138943';
let KOMMUN_COLOR_SELECTED = localStorage.getItem('selectedColor') || DEFAULT_KOMMUN_COLOR;
const KOMMUN_COLOR_UNSELECTED = '#dee2e6';

// Funktion för att uppdatera vald färg
function updateSelectedColor(newColor, skipSave = false) {
    KOMMUN_COLOR_SELECTED = newColor;
    if (!skipSave) {
        localStorage.setItem('selectedColor', newColor);
    }

    // Uppdatera CSS-variabler för att matcha nya färgen
    document.documentElement.style.setProperty('--color-selected', newColor);

    // Beräkna en mörkare variant för text/kontrast
    const darker = adjustColor(newColor, -20);
    document.documentElement.style.setProperty('--color-selected-dark', darker);

    // Uppdatera färgvaljarens värde i UI om det behövs
    const colorPicker = document.getElementById('map-color-picker');
    if (colorPicker && colorPicker.value !== newColor) {
        colorPicker.value = newColor;
    }

    // Uppdatera alla markerade kommuner på kartan
    const checkedCheckboxes = document.querySelectorAll('#checkbox-list input[type="checkbox"]:checked');
    checkedCheckboxes.forEach(checkbox => {
        toggleKommunColor({ target: checkbox });
    });
}

// Hjälpfunktion för att mörka ner/ljusa upp en hex-färg
function adjustColor(hex, percent) {
    // Validera hex-format
    if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return hex;

    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    r = Math.floor(r * (100 + percent) / 100);
    g = Math.floor(g * (100 + percent) / 100);
    b = Math.floor(b * (100 + percent) / 100);

    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Funktion för att ändra färg på kommun baserat på checkboxstatus
function toggleKommunColor(event) {
    const kommunKod = event.target.value;
    const color = event.target.checked ? KOMMUN_COLOR_SELECTED : KOMMUN_COLOR_UNSELECTED;

    // Hämta alla element med kommunens ID (det kan vara enskilda element eller grupperade element)
    const kommuner = document.querySelectorAll(`[id="${kommunKod}"]`);

    kommuner.forEach(kommun => {
        if (kommun.tagName.toLowerCase() === 'g') {
            const polygons = kommun.querySelectorAll('polygon, path');
            polygons.forEach(polygon => {
                // Om avmarkerad, ta bort inline-style så att CSS-färgen tar över
                polygon.style.fill = event.target.checked ? color : '';
            });
        } else {
            kommun.style.fill = event.target.checked ? color : '';
        }
    });

    // Uppdatera label-klass för CSS-styling (fallback för :has() selector)
    const label = event.target.parentElement;
    if (label && label.tagName.toLowerCase() === 'label') {
        if (event.target.checked) {
            label.classList.add('checked');
        } else {
            label.classList.remove('checked');
        }
    }

    // Persist each checkbox change in a simple global state
    saveCheckboxState(event.target.id, event.target.checked);

    // Uppdatera räknaren
    updateSelectionCounter();
}


// Funktion för att avmarkera alla checkboxar och återställa färgen på alla kommuner
function uncheckAllCheckboxes() {
    const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        toggleKommunColor({ target: checkbox });
    });
}

// Funktion för att markera alla checkboxar och ändra färgen på alla kommuner
function checkAllCheckboxes() {
    const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        // Uppdatera färgen på kommunerna när de markeras
        const event = new Event('change');
        checkbox.dispatchEvent(event);
    });
}


// Funktion för att spara checkbox-tillstånd i localStorage
function saveCheckboxState(checkboxId, isChecked) {
    // Ta bort 'cb-' prefixet för att spara med kommun-koden
    const kommunKod = checkboxId.replace('cb-', '');
    const checkboxState = JSON.parse(localStorage.getItem('checkboxState')) || {};
    checkboxState[kommunKod] = isChecked;
    localStorage.setItem('checkboxState', JSON.stringify(checkboxState));
}


// Funktion för att spara en uppsättning checkbox-tillstånd med ett visst namn
function saveState(stateName, button = null) {
    // Validate state name
    if (!stateName || typeof stateName !== 'string' || stateName.trim().length === 0) {
        showToast('Ogiltigt namn. Ange ett giltigt namn.', 'error');
        return;
    }

    // Sanitize state name to prevent XSS
    const sanitizedStateName = stateName.trim().replace(/[^a-zA-Z0-9\s\-_åäöÅÄÖ]/g, '');
    if (sanitizedStateName !== stateName.trim()) {
        showToast('Namnet innehåller ogiltiga tecken.', 'warning');
        return;
    }

    if (button) setButtonLoading(button, true);

    try {
        const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
        const checkboxState = {};
        let checkedCount = 0;
        checkboxes.forEach(checkbox => {
            const kommunKod = checkbox.id.replace('cb-', '');
            checkboxState[kommunKod] = checkbox.checked;
            if (checkbox.checked) checkedCount++;
        });

        // Spara med metadata
        const stateData = {
            state: checkboxState,
            savedAt: new Date().toISOString(),
            checkedCount: checkedCount
        };

        localStorage.setItem(`kommunkarta_${sanitizedStateName}`, JSON.stringify(stateData));
        showToast(`Kartan "${sanitizedStateName}" har sparats!`, 'success');
        updateSavedStatesList();
    } catch (error) {
        console.error('Failed to save state:', error);
        showToast('Kunde inte spara. Kontrollera lagringsutrymme.', 'error');
    } finally {
        if (button) setButtonLoading(button, false);
    }
}

// Funktion för att ladda en uppsättning checkbox-tillstånd med ett visst namn
function loadState(stateName, button = null) {
    if (!stateName || typeof stateName !== 'string' || stateName.trim().length === 0) {
        showToast('Ogiltigt namn.', 'error');
        return;
    }

    if (button) setButtonLoading(button, true);

    try {
        // Försök hitta med nytt prefix först, sedan utan
        let savedData = localStorage.getItem(`kommunkarta_${stateName}`);
        let isNewFormat = true;

        if (!savedData) {
            savedData = localStorage.getItem(stateName);
            isNewFormat = false;
        }

        if (!savedData) {
            showToast(`"${stateName}" hittades inte.`, 'warning');
            if (button) setButtonLoading(button, false);
            return;
        }

        const parsed = JSON.parse(savedData);
        const savedCheckboxState = isNewFormat ? parsed.state : parsed;

        const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = savedCheckboxState[checkbox.value] || false;
            const event = new Event('change');
            checkbox.dispatchEvent(event);
        });

        const checkedCount = document.querySelectorAll('#checkbox-list input[type="checkbox"]:checked').length;
        showToast(`Kartvyn "${stateName}" visas nu`, 'success');
        updateSelectionCounter();
    } catch (error) {
        console.error('Failed to load state:', error);
        showToast('Kunde inte ladda. Data kan vara korrupt.', 'error');
    } finally {
        if (button) setButtonLoading(button, false);
    }
}

// Funktion för att ladda flera tillstånd och kombinera dem
function loadMultipleStates(stateNames, button = null) {
    if (!Array.isArray(stateNames) || stateNames.length === 0) {
        showToast('Inga tillstånd att ladda.', 'warning');
        return;
    }

    if (button) setButtonLoading(button, true);

    let combinedCheckboxState = {};
    let loadedStates = 0;
    const totalStates = stateNames.length;

    try {
        stateNames.forEach(stateName => {
            if (typeof stateName !== 'string' || stateName.trim().length === 0) {
                return;
            }

            // Försök hitta med nytt prefix först, sedan utan
            let savedData = localStorage.getItem(`kommunkarta_${stateName}`);
            let isNewFormat = true;

            if (!savedData) {
                savedData = localStorage.getItem(stateName);
                isNewFormat = false;
            }

            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    const savedCheckboxState = isNewFormat ? parsed.state : parsed;
                    loadedStates++;
                    Object.keys(savedCheckboxState).forEach(kommunKod => {
                        combinedCheckboxState[kommunKod] = combinedCheckboxState[kommunKod] || savedCheckboxState[kommunKod];
                    });
                } catch (parseError) {
                    console.error(`Failed to parse state ${stateName}:`, parseError);
                }
            }
        });

        const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = combinedCheckboxState[checkbox.value] || false;
            const event = new Event('change');
            checkbox.dispatchEvent(event);
        });

        if (loadedStates > 0) {
            const checkedCount = document.querySelectorAll('#checkbox-list input[type="checkbox"]:checked').length;
            showToast(`${loadedStates} sparade kartor öppnades`, 'success');
        } else {
            showToast('Inga sparade kartor hittades.', 'warning');
        }
        updateSelectionCounter();
    } catch (error) {
        console.error('Failed to load multiple states:', error);
        showToast('Kunde inte öppna de sparade kartorna.', 'error');
    } finally {
        if (button) setButtonLoading(button, false);
    }
}

// ============================================
// DYNAMIC SAVED STATES MANAGER
// ============================================

// Hämta alla sparade tillstånd från localStorage
function getSavedStates() {
    const states = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('kommunkarta_')) {
            const name = key.replace('kommunkarta_', '');
            try {
                const data = JSON.parse(localStorage.getItem(key));
                states.push({
                    name: name,
                    key: key,
                    savedAt: data.savedAt || null,
                    checkedCount: data.checkedCount || 0
                });
            } catch (e) {
                states.push({ name: name, key: key, savedAt: null, checkedCount: 0 });
            }
        }
    }
    // Sortera efter datum (nyast först)
    states.sort((a, b) => {
        if (!a.savedAt) return 1;
        if (!b.savedAt) return -1;
        return new Date(b.savedAt) - new Date(a.savedAt);
    });
    return states;
}

// Uppdatera listan med sparade tillstånd i UI
function updateSavedStatesList() {
    const container = document.getElementById('saved-states-list');
    if (!container) return;

    const states = getSavedStates();

    if (states.length === 0) {
        container.innerHTML = '<p class="no-states">Inga sparade kartor än</p>';
        return;
    }

    container.innerHTML = states.map(state => {
        const date = state.savedAt ? new Date(state.savedAt).toLocaleDateString('sv-SE') : '';
        return `
            <div class="saved-state-item" data-state="${state.name}">
                <div class="state-info">
                    <span class="state-name">${state.name}</span>
                    <span class="state-meta">${state.checkedCount} markerade${date ? ' • ' + date : ''}</span>
                </div>
                <div class="state-actions">
                    <button class="state-load-btn" data-state="${state.name}" title="Ladda">▶</button>
                    <button class="state-delete-btn" data-state="${state.name}" title="Ta bort">×</button>
                </div>
            </div>
        `;
    }).join('');

    // Lägg till event listeners för knapparna
    container.querySelectorAll('.state-load-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadState(btn.dataset.state, btn);
        });
    });

    container.querySelectorAll('.state-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteState(btn.dataset.state);
        });
    });
}

// Ta bort ett sparat tillstånd med bekräftelse
function deleteState(stateName) {
    if (!stateName) return;

    showConfirmDialog(
        `Vill du ta bort "${stateName}"?`,
        () => {
            localStorage.removeItem(`kommunkarta_${stateName}`);
            showToast(`"${stateName}" har tagits bort`, 'info');
            updateSavedStatesList();
        }
    );
}

// Visa en bekräftelsedialog
function showConfirmDialog(message, onConfirm, onCancel = null) {
    // Ta bort eventuell existerande dialog
    const existing = document.getElementById('confirm-dialog-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirm-dialog-overlay';
    overlay.className = 'confirm-overlay';

    overlay.innerHTML = `
        <div class="confirm-dialog">
            <p class="confirm-message">${message}</p>
            <div class="confirm-actions">
                <button class="confirm-btn confirm-cancel">Avbryt</button>
                <button class="confirm-btn confirm-delete">Ta bort</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Animera in
    requestAnimationFrame(() => {
        overlay.classList.add('confirm-visible');
    });

    const closeDialog = () => {
        overlay.classList.remove('confirm-visible');
        setTimeout(() => overlay.remove(), 200);
    };

    // Event listeners
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => {
        closeDialog();
        if (onCancel) onCancel();
    });

    overlay.querySelector('.confirm-delete').addEventListener('click', () => {
        closeDialog();
        onConfirm();
    });

    // Stäng vid klick på overlay
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeDialog();
            if (onCancel) onCancel();
        }
    });

    // Stäng vid Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            if (onCancel) onCancel();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Spara nytt tillstånd med anpassat namn
function saveCustomState() {
    const input = document.getElementById('custom-state-name');
    if (!input) return;

    const name = input.value.trim();
    if (!name) {
        showToast('Ge din karta ett namn...', 'warning');
        input.focus();
        return;
    }

    const saveBtn = document.getElementById('save-custom-btn');
    saveState(name, saveBtn);
    input.value = '';
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupButtonListeners() {
    // Checkbox control buttons
    const checkAllBtn = document.getElementById('check-all-btn');
    const uncheckAllBtn = document.getElementById('uncheck-all-btn');

    if (checkAllBtn) checkAllBtn.addEventListener('click', checkAllCheckboxes);
    if (uncheckAllBtn) uncheckAllBtn.addEventListener('click', uncheckAllCheckboxes);

    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function () {
            exportMap(this);
        });
    }

    // Zoom buttons
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');

    if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);

    const recenterBtn = document.getElementById('recenter-btn');
    if (recenterBtn) {
        recenterBtn.addEventListener('click', centerMapInContainer);
    }

    // Custom state save
    const saveCustomBtn = document.getElementById('save-custom-btn');
    if (saveCustomBtn) {
        saveCustomBtn.addEventListener('click', saveCustomState);
    }

    // Custom state input - spara vid Enter
    const customInput = document.getElementById('custom-state-name');
    if (customInput) {
        customInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveCustomState();
            }
        });
    }

    // Load all states button
    const loadAllBtn = document.getElementById('load-all-states-btn');
    if (loadAllBtn) {
        loadAllBtn.addEventListener('click', function () {
            const states = getSavedStates();
            const stateNames = states.map(s => s.name);
            if (stateNames.length > 0) {
                loadMultipleStates(stateNames, this);
            } else {
                showToast('Inga sparade kartor att visa', 'warning');
            }
        });
    }

    // Share link listener
    const shareLinkBtn = document.getElementById('share-link-btn');
    if (shareLinkBtn) {
        shareLinkBtn.addEventListener('click', shareMapLink);
    }

    // Kopiera lista listener
    const copyListBtn = document.getElementById('copy-list-btn');
    if (copyListBtn) {
        copyListBtn.addEventListener('click', copySelectedList);
    }

    // Color picker listener
    const colorPicker = document.getElementById('map-color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            updateSelectedColor(e.target.value);
        });
    }

    // Reset color listener
    const resetColorBtn = document.getElementById('reset-color-btn');
    if (resetColorBtn) {
        resetColorBtn.addEventListener('click', () => {
            updateSelectedColor(DEFAULT_KOMMUN_COLOR);
            showToast('Färgen har återställts till standard', 'info', 2000);
        });
    }

    // Initialisera listan med sparade kartor
    updateSavedStatesList();
}

// Funktion för att skapa en delningslänk
function shareMapLink() {
    const checked = document.querySelectorAll('#checkbox-list input[type="checkbox"]:checked');
    if (checked.length === 0) {
        showToast('Markera några kommuner först för att kunna dela.', 'warning');
        return;
    }

    const codes = Array.from(checked).map(cb => cb.value).join(',');
    const color = KOMMUN_COLOR_SELECTED.replace('#', '');

    // Skapa URL
    const url = new URL(window.location.href);
    url.searchParams.set('s', codes);
    url.searchParams.set('c', color);

    // Kopiera till urklipp
    navigator.clipboard.writeText(url.toString()).then(() => {
        showToast('Länken har kopierats till urklipp!', 'success');
    }).catch(err => {
        console.error('Kunde inte kopiera länk:', err);
        showToast('Kunde inte kopiera länken automatiskt.', 'error');
    });
}

// Funktion för att kopiera lista över markerade kommuner som text
function copySelectedList() {
    const checked = document.querySelectorAll('#checkbox-list input[type="checkbox"]:checked');
    if (checked.length === 0) {
        showToast('Markera några kommuner först för att kunna kopiera listan.', 'warning');
        return;
    }

    const kommunNames = Array.from(checked).map(cb => {
        const id = cb.value;
        const kommun = globalKommunerMap[id];
        return kommun ? kommun.name : id;
    }).sort((a, b) => a.localeCompare(b, 'sv'));

    const listText = kommunNames.join('\n');

    navigator.clipboard.writeText(listText).then(() => {
        showToast(`Kopierade ${kommunNames.length} kommuner till urklipp!`, 'success');
    }).catch(err => {
        console.error('Kunde inte kopiera lista:', err);
        showToast('Kunde inte kopiera listan automatiskt.', 'error');
    });
}

// Funktion för att hantera hjälp-modalen
function setupHelpSystem() {
    const helpBtn = document.getElementById('help-btn');
    const closeHelpBtn = document.getElementById('close-help-btn');
    const helpModal = document.getElementById('help-modal');

    if (!helpBtn || !helpModal) return;

    const showHelp = () => {
        helpModal.style.display = 'flex';
    };

    const hideHelp = () => {
        helpModal.style.display = 'none';
    };

    helpBtn.addEventListener('click', showHelp);
    if (closeHelpBtn) closeHelpBtn.addEventListener('click', hideHelp);

    // Stäng vid klick utanför modalen
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) hideHelp();
    });

    // Stäng med Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && helpModal.style.display === 'flex') {
            hideHelp();
        }
    });
}

// Funktion för att läsa in delad karta från URL
function parseShareParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const codesStr = urlParams.get('s');
    const colorParam = urlParams.get('c');

    if (!codesStr) return;

    // Sätt färg om den finns
    if (colorParam) {
        updateSelectedColor('#' + colorParam);
    }

    // Markera kommuner
    const codes = codesStr.split(',');
    let count = 0;

    codes.forEach(code => {
        const cb = document.getElementById('cb-' + code);
        if (cb) {
            cb.checked = true;
            toggleKommunColor({ target: cb });
            count++;
        }
    });

    if (count > 0) {
        showToast(`Öppnade delad karta med ${count} kommuner`, 'success');
        updateSelectionCounter();

        // Rensa URL-parametrar efter laddning (valfritt, men gör det renare)
        // window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Anropa setupButtonListeners när DOM är redo
document.addEventListener('DOMContentLoaded', setupButtonListeners);


// ZOOM-FUNKTIONER

// Variabler för zoomnivå och position (source of truth)
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Performance optimization: Cache DOM elements and rAF id
let svgMapElement = null;
let mapContainerElement = null;
let rafId = null;

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// Initialize cached DOM elements
function initializeCache() {
    if (!svgMapElement) {
        svgMapElement = document.getElementById("sweden-map");
    }
    if (!mapContainerElement) {
        mapContainerElement = document.getElementById("mapContainer");
    }
}

// Setup Search functionality
function setupSearch(kommuner) {
    if (!kommunSearchInput) return;

    kommunSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        let matchCount = 0;

        // Hämta alla region-grupper och deras checkboxes
        const groups = document.querySelectorAll('.region-group');
        let hasVisibleGroup = false;

        groups.forEach(group => {
            const labels = group.querySelectorAll('label');
            let groupHasMatch = false;

            // Om söksträngen är tom, visa allt
            if (!query) {
                group.style.display = 'flex';
                labels.forEach(l => l.style.display = 'flex');
                matchCount += labels.length;
                hasVisibleGroup = true;
                groupHasMatch = true;
            } else {
                // Sök matchningar inom gruppen
                labels.forEach(label => {
                    const name = label.dataset.kommunName;
                    const code = label.dataset.kommunCode;

                    if (name.includes(query) || code.includes(query)) {
                        label.style.display = 'flex';
                        matchCount++;
                        groupHasMatch = true;
                    } else {
                        label.style.display = 'none';
                    }
                });

                // Göm hela gruppen om inga kommuner matchar
                group.style.display = groupHasMatch ? 'flex' : 'none';
                if (groupHasMatch) hasVisibleGroup = true;
            }
            // Hantera förälder till gruppen (checkbox-column)
            if (group.parentElement && group.parentElement.classList.contains('checkbox-column')) {
                group.parentElement.style.display = groupHasMatch ? 'flex' : 'none';
            }
        });

        if (searchCountSpan) {
            searchCountSpan.textContent = query ? `${matchCount} träffar` : '';
        }
    });
}

// Setup Map Hover interactions
function setupMapInteractions(kommunDataMap) {
    if (!svgMap) return;

    svgMap.addEventListener('mousemove', (e) => {
        const target = e.target;
        let kommunGroup = target.closest('g') || target;
        let id = kommunGroup.id;

        if (!id || id.length !== 4) return;

        const kommun = kommunDataMap[id];
        if (kommun) {
            showTooltip(e, kommun.name);
            target.style.opacity = '0.7';

            // Highlight i listan
            const label = document.getElementById('cb-' + id)?.parentElement;
            if (label) {
                label.classList.add('hover-highlight');
                // Scrolla fram elementet om det inte syns (valfritt, men snyggt)
                // label.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    });

    svgMap.addEventListener('mouseout', (e) => {
        hideTooltip();
        const target = e.target;
        let kommunGroup = target.closest('g') || target;
        let id = kommunGroup.id;

        target.style.opacity = '1';

        if (id) {
            const label = document.getElementById('cb-' + id)?.parentElement;
            if (label) label.classList.remove('hover-highlight');
        }
    });

    // Klick på kartan -> Toggle checkbox
    svgMap.addEventListener('click', (e) => {
        let kommunGroup = e.target.closest('g') || e.target;
        let id = kommunGroup.id;

        if (id && id.length === 4) {
            const checkbox = document.getElementById('cb-' + id);
            if (checkbox) {
                checkbox.click();
            }
        }
    });
}

function showTooltip(e, text) {
    if (!tooltip) return;
    tooltip.textContent = text;
    tooltip.classList.add('visible');

    // Positionera tooltip
    const x = e.pageX + 10;
    const y = e.pageY + 10;

    // Förhindra overflow utanför skärm
    tooltip.style.left = `${Math.min(x, window.innerWidth - 150)}px`;
    tooltip.style.top = `${Math.min(y, window.innerHeight - 50)}px`;
}

function hideTooltip() {
    if (tooltip) tooltip.classList.remove('visible');
}

// JSON Import/Export
function setupJsonExportImport() {
    const exportBtn = document.getElementById('export-json-btn');
    const importBtn = document.getElementById('import-json-btn');
    const fileInput = document.getElementById('import-file-input');

    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const checkedCheckboxes = document.querySelectorAll('#checkbox-list input[type="checkbox"]:checked');
            const selection = {};
            checkedCheckboxes.forEach(cb => {
                selection[cb.value] = true;
            });

            const dataStr = JSON.stringify(selection, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `min-karta-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showToast('Kartan sparad som fil', 'success');
        });
    }

    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);
                    // Rensa nuvarande
                    uncheckAllCheckboxes();

                    let count = 0;
                    Object.keys(importedData).forEach(code => {
                        const cb = document.getElementById('cb-' + code);
                        if (cb) {
                            cb.checked = true;
                            // Trigger färgändring
                            toggleKommunColor({ target: cb });
                            count++;
                        }
                    });

                    showToast(`Kartvyn öppnades (${count} markerade kommuner)`, 'success');
                    updateSelectionCounter();
                } catch (err) {
                    console.error('JSON Parse error', err);
                    showToast('Kunde inte läsa filen', 'error');
                }
                fileInput.value = ''; // Reset
            };
            reader.readAsText(file);
        });
    }
}

// Setup Search functionality
function setupSearch(kommuner, regions) {
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            renderCheckboxListBasedOnSort();
        });
    }

    if (!kommunSearchInput) return;

    kommunSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        let matchCount = 0;

        // Determine current view mode to filter correctly
        const sortMode = sortSelect ? sortSelect.value : 'region';

        if (sortMode === 'region') {
            // Region mode search
            const groups = document.querySelectorAll('.region-group');

            groups.forEach(group => {
                const labels = group.querySelectorAll('label');
                let groupHasMatch = false;

                if (!query) {
                    group.style.display = 'flex';
                    labels.forEach(l => l.style.display = 'flex');
                    matchCount += labels.length;
                    groupHasMatch = true;
                } else {
                    labels.forEach(label => {
                        const name = label.dataset.kommunName;
                        const code = label.dataset.kommunCode;

                        if (name.includes(query) || code.includes(query)) {
                            label.style.display = 'flex';
                            matchCount++;
                            groupHasMatch = true;
                        } else {
                            label.style.display = 'none';
                        }
                    });
                    group.style.display = groupHasMatch ? 'flex' : 'none';
                }

                // Hantera föräldern (checkbox-column)
                if (group.parentElement && group.parentElement.classList.contains('checkbox-column')) {
                    group.parentElement.style.display = groupHasMatch ? 'flex' : 'none';
                }
            });
        } else {
            // Flat mode search
            const labels = document.querySelectorAll('.flat-list label');
            labels.forEach(label => {
                const name = label.dataset.kommunName;
                const code = label.dataset.kommunCode;
                if (!query || name.includes(query) || code.includes(query)) {
                    label.style.display = 'flex';
                    matchCount++;
                } else {
                    label.style.display = 'none';
                }
            });
        }

        if (searchCountSpan) {
            searchCountSpan.textContent = query ? `${matchCount} träffar` : '';
        }
    });
}



// Funktion för att uppdatera transformeringen (zoom och panorering)
// NOTE: translate THEN scale ordering keeps pan offsets in unscaled pixels, making math simpler.
function updateTransform() {
    initializeCache();
    if (svgMapElement) {
        svgMapElement.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        svgMapElement.style.transformOrigin = '0 0'; // ensure consistent origin
    }
}

// Function to center and fit the map in the container
function centerMapInContainer() {
    initializeCache();
    if (svgMapElement && mapContainerElement) {
        // Reset transformations first
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        svgMapElement.style.transform = 'none';

        // Get container dimensions
        const containerRect = mapContainerElement.getBoundingClientRect();
        const padding = 20; // Padding runt kartan

        // Hämta SVG:ns faktiska dimensioner från viewBox eller attribut
        const svgElement = svgMapElement.querySelector('svg');
        let svgWidth, svgHeight;

        if (svgElement) {
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
                const parts = viewBox.split(' ');
                svgWidth = parseFloat(parts[2]) || 600;
                svgHeight = parseFloat(parts[3]) || 800;
            } else {
                svgWidth = parseFloat(svgElement.getAttribute('width')) || 600;
                svgHeight = parseFloat(svgElement.getAttribute('height')) || 800;
            }
        } else {
            // Fallback - använd getBBox
            try {
                const bbox = svgMapElement.getBBox();
                svgWidth = bbox.width || 600;
                svgHeight = bbox.height || 800;
            } catch (e) {
                svgWidth = 600;
                svgHeight = 800;
            }
        }

        // Beräkna skala för att få plats med hela kartan
        const availableWidth = containerRect.width - padding * 2;
        const availableHeight = containerRect.height - padding * 2;

        const scaleX = availableWidth / svgWidth;
        const scaleY = availableHeight / svgHeight;

        // Använd den mindre skalan för att behålla proportionerna
        scale = Math.min(scaleX, scaleY, 1); // Max 1 = inte större än originalet

        // Beräkna offset för att centrera kartan
        const scaledWidth = svgWidth * scale;
        const scaledHeight = svgHeight * scale;

        offsetX = (containerRect.width - scaledWidth) / 2;
        offsetY = (containerRect.height - scaledHeight) / 2;

        updateTransform();
    }
}

// Debounced zoom functions for keyboard/dblclick usage
function debouncedZoom(callback) {
    if (rafId) {
        cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(callback);
}

// Funktion för att zooma in
function zoomIn() {
    debouncedZoom(() => {
        const newScale = Math.min(scale + 0.5, 5);
        // zoom centered on container center
        initializeCache();
        if (mapContainerElement) {
            const rect = mapContainerElement.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            offsetX += cx * (1 / newScale - 1 / scale);
            offsetY += cy * (1 / newScale - 1 / scale);
        }
        scale = newScale;
        updateTransform();
    });
}

// Funktion för att zooma ut
function zoomOut() {
    debouncedZoom(() => {
        const newScale = Math.max(scale - 0.5, 0.5);
        initializeCache();
        if (mapContainerElement) {
            const rect = mapContainerElement.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            offsetX += cx * (1 / newScale - 1 / scale);
            offsetY += cy * (1 / newScale - 1 / scale);
        }
        scale = newScale;
        updateTransform();
    });
}

// Funktion för att zooma in genom dubbelklick (toward cursor)
function zoomInOnDoubleClick(event) {
    debouncedZoom(() => {
        initializeCache();
        const rect = mapContainerElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const newScale = Math.min(scale * 1.5, 5);
        offsetX += mouseX * (1 / newScale - 1 / scale);
        offsetY += mouseY * (1 / newScale - 1 / scale);
        scale = newScale;
        updateTransform();
    });
}

// Funktion för att zooma ut genom dubbelklick (toward cursor)
function zoomOutOnDoubleClick(event) {
    debouncedZoom(() => {
        initializeCache();
        const rect = mapContainerElement.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const newScale = Math.max(scale * 0.5, 0.5);
        offsetX += mouseX * (1 / newScale - 1 / scale);
        offsetY += mouseY * (1 / newScale - 1 / scale);
        scale = newScale;
        updateTransform();
    });
}

// Panning variables
let isDragging = false;
let startX = 0;
let startY = 0;
let startOffsetX = 0;
let startOffsetY = 0;

// Funktion för att börja panorera
function startPan(event) {
    // Don't start panning if clicking on zoom controls
    if (event.target && event.target.closest && event.target.closest('.zoom-controls')) {
        return;
    }
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
}

// Funktion för att panorera kartan
function panMap(event) {
    if (isDragging) {
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        offsetX = startOffsetX + dx;
        offsetY = startOffsetY + dy;
        updateTransform();
    }
}

// Funktion för att avsluta panorering
function endPan() {
    isDragging = false;
}

// Wheel zoom function (single coherent handler)
// Zooms toward the mouse cursor and updates scale/offset variables so state stays consistent
function handleWheelZoom(event) {
    // Prevent page scrolling; listener must be added with { passive: false }
    event.preventDefault();

    initializeCache();
    if (!mapContainerElement || !svgMapElement) return;

    // Wheel delta: negative = wheel up (zoom in), positive = wheel down (zoom out)
    const delta = -event.deltaY;

    // exponential zoom for smooth feel; tweak zoomIntensity to adjust sensitivity
    const zoomIntensity = 0.0015;
    const newScale = clamp(scale * Math.exp(delta * zoomIntensity), 0.5, 5);

    // Compute mouse position relative to container (unscaled coordinates)
    const rect = mapContainerElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Adjust offsets so the point under the cursor stays fixed during zoom
    // Formula: new_offset = offset + (mouse_pos - offset) * (1 - new_scale / old_scale)
    offsetX = offsetX + (mouseX - offsetX) * (1 - newScale / scale);
    offsetY = offsetY + (mouseY - offsetY) * (1 - newScale / scale);

    scale = newScale;

    if (rafId) {
        cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
        updateTransform();
    });
}

// Keyboard navigation function
function handleKeyboardNavigation(event) {
    const key = event.key;
    const step = 50; // Pan step size

    // Don't handle when focusing text inputs
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
    }

    switch (key) {
        case 'ArrowUp':
            event.preventDefault();
            panMapByCoordinates(0, -step);
            break;
        case 'ArrowDown':
            event.preventDefault();
            panMapByCoordinates(0, step);
            break;
        case 'ArrowLeft':
            event.preventDefault();
            panMapByCoordinates(-step, 0);
            break;
        case 'ArrowRight':
            event.preventDefault();
            panMapByCoordinates(step, 0);
            break;
        case '+':
        case '=':
            event.preventDefault();
            zoomIn();
            break;
        case '-':
            event.preventDefault();
            zoomOut();
            break;
        case '0':
            event.preventDefault();
            resetView();
            break;
        case 'Escape':
            event.preventDefault();
            resetView();
            break;
    }
}

// Function to pan map by coordinates (utility function)
function panMapByCoordinates(dx, dy) {
    offsetX += dx;
    offsetY += dy;
    updateTransform();
}

// Initialize event listeners after DOM loaded
document.addEventListener("DOMContentLoaded", function () {
    initializeCache();

    // double click zoom on the SVG map
    if (svgMapElement) {
        svgMapElement.addEventListener("dblclick", function (event) {
            if (event.ctrlKey) {
                zoomOutOnDoubleClick(event);
            } else {
                zoomInOnDoubleClick(event);
            }
        });
    }

    // wheel zoom on container (single handler) — ensure passive: false so preventDefault works
    if (mapContainerElement) {
        mapContainerElement.addEventListener('wheel', handleWheelZoom, { passive: false });
        mapContainerElement.addEventListener('mousedown', startPan);
    }

    // mouse move/up for panning
    document.addEventListener('mousemove', panMap);
    document.addEventListener('mouseup', endPan);

    // keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);

    // Prevent zoom controls from triggering pan
    const zoomControls = document.querySelector('.zoom-controls');
    if (zoomControls) {
        zoomControls.addEventListener('mousedown', function (event) {
            event.stopPropagation(); // Prevent pan from starting when clicking zoom controls
        });
    }

    // Apply initial transform to ensure consistent state
    updateTransform();
});


// EXPORTERA KARTAN

// Funktion för att återställa kartan till ursprunglig vy
function resetView() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
}

// Funktion för att exportera kartan som en SVG-fil
function exportMap(button = null) {
    initializeCache();

    if (!svgMapElement) {
        showToast('Kartan kunde inte hittas.', 'error');
        return;
    }

    if (button) setButtonLoading(button, true);

    try {
        // Spara nuvarande transformation
        const currentScale = scale;
        const currentOffsetX = offsetX;
        const currentOffsetY = offsetY;

        // Återställ kartan till ursprunglig vy temporärt
        resetView();

        // Vänta på att återställningen ska slå igenom
        requestAnimationFrame(() => {
            try {
                // Hämta den inre SVG:n (den som laddades från kommunKarta.svg)
                const innerSvg = svgMapElement.querySelector('svg');

                if (!innerSvg) {
                    // Om ingen inre SVG finns, använd svgMapElement direkt
                    throw new Error('Ingen SVG-karta hittades');
                }

                // Klona den inre SVG:n
                const svgCopy = innerSvg.cloneNode(true);

                // Ta bort eventuell transform
                svgCopy.style.transform = 'none';

                // Försök hämta viewBox från originalet, eller beräkna från innehållet
                let viewBox = innerSvg.getAttribute('viewBox');

                if (!viewBox) {
                    // Försök beräkna från getBBox
                    try {
                        const bbox = innerSvg.getBBox();
                        const padding = 20;
                        viewBox = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + 2 * padding} ${bbox.height + 2 * padding}`;
                    } catch (e) {
                        // Fallback till standardstorlek
                        viewBox = '0 0 600 800';
                    }
                }

                svgCopy.setAttribute('viewBox', viewBox);

                // Sätt width och height för bättre kompatibilitet
                svgCopy.setAttribute('width', '100%');
                svgCopy.setAttribute('height', '100%');

                // Skapa en SVG-sträng från kopian av SVG-elementet
                const svgString = new XMLSerializer().serializeToString(svgCopy);

                // Skapa en Blob med den nya SVG-strängen
                const blob = new Blob([svgString], { type: "image/svg+xml" });

                // Skapa en URL från Blob
                const url = URL.createObjectURL(blob);

                // Skapa en länk för att ladda ner SVG-filen
                const link = document.createElement("a");
                link.href = url;
                link.download = "sweden-map.svg";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Återkalla URL:en
                URL.revokeObjectURL(url);

                // Återställ tidigare transformation
                scale = currentScale;
                offsetX = currentOffsetX;
                offsetY = currentOffsetY;
                updateTransform();

                showToast('Kartan har exporterats som SVG!', 'success');
                if (button) setButtonLoading(button, false);
            } catch (exportError) {
                console.error('Export failed:', exportError);
                showToast('Kunde inte exportera kartan.', 'error');

                // Restore view even if export failed
                scale = currentScale;
                offsetX = currentOffsetX;
                offsetY = currentOffsetY;
                updateTransform();
                if (button) setButtonLoading(button, false);
            }
        });
    } catch (error) {
        console.error('Export initialization failed:', error);
        showToast('Kunde inte starta exporten.', 'error');
        if (button) setButtonLoading(button, false);
    }
}



