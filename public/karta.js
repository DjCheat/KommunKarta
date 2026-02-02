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

    let counter = document.getElementById('selection-counter');
    if (!counter) {
        // Skapa counter om den inte finns
        const controlsContainer = document.querySelector('.checkbox-controls-container');
        if (controlsContainer) {
            counter = document.createElement('div');
            counter.id = 'selection-counter';
            controlsContainer.insertBefore(counter, controlsContainer.firstChild);
        }
    }

    if (counter) {
        counter.textContent = `${checked.length} av ${checkboxes.length} kommuner valda`;
        counter.className = checked.length > 0 ? 'selection-counter has-selection' : 'selection-counter';
    }
}

// ============================================
// MAIN APPLICATION CODE
// ============================================

// Hämta SVG-elementet för kartan (used for initial injection)
const svgMap = document.getElementById('sweden-map');

// Hämta checkboxlistan
const checkboxList = document.getElementById('checkbox-list');

// Asynkron initialisering av kartan
async function initializeMap() {
    try {
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

        // Lägg till SVG-filen i dokumentet
        svgMap.innerHTML = svgData;

        // Hämta kommunkoderna i ordning från JSON-data och sortera dem i bokstavsordning (svenska)
        const kommunKoder = Object.keys(data).sort((a, b) => {
            const kommunNamnA = data[a] || '';
            const kommunNamnB = data[b] || '';
            return kommunNamnA.localeCompare(kommunNamnB, 'sv', { sensitivity: 'base' });
        });

        // Återställ checkbox-tillstånd från localStorage (if previously saved)
        const savedCheckboxState = JSON.parse(localStorage.getItem('checkboxState')) || {};

        // Loopa igenom varje kommun i den sorterade ordningen
        kommunKoder.forEach(kommunKod => {
            const kommunNamn = data[kommunKod];
            let kommun = document.getElementById(kommunKod);

            // Om kommunen inte hittades direkt, försök hitta den inuti grupperade objekt
            if (!kommun) {
                kommun = document.querySelector(`g[id="${kommunKod}"]`);
            }

            if (kommun) {
                // Skapa checkboxar för varje kommun
                // Använd unikt ID för checkbox (med prefix) för att undvika konflikt med SVG-element
                const checkboxId = 'cb-' + kommunKod;

                const label = document.createElement('label');
                label.htmlFor = checkboxId;
                label.style.cursor = 'pointer';
                label.style.userSelect = 'none';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = kommunKod;
                checkbox.id = checkboxId;
                checkbox.addEventListener('change', toggleKommunColor);

                // Restore saved state if any
                if (savedCheckboxState[kommunKod]) {
                    checkbox.checked = true;
                }

                // Lägg till checkbox och text i label
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(kommunNamn));
                checkboxList.appendChild(label);

                // Uppdatera kommunens färg baserat på checkboxens tillstånd
                toggleKommunColor({ target: checkbox });
            }
        });

        // Vänta på att layouten ska vara klar innan vi justerar
        setTimeout(() => {
            adjustCheckboxListLayout();
            centerMapInContainer();
            updateSelectionCounter();
        }, 100);

    } catch (error) {
        console.error('Fel vid initialisering av kartan:', error);
        showToast('Kunde inte ladda kartan. Försök ladda om sidan.', 'error', 5000);
    }
}

// Starta initialiseringen
initializeMap();


// Färger för kommuner (matchar CSS-variabler)
const KOMMUN_COLOR_SELECTED = '#10b981';
const KOMMUN_COLOR_UNSELECTED = '#e2e8f0';

// Funktion för att ändra färg på kommun baserat på checkboxstatus
function toggleKommunColor(event) {
    const kommunKod = event.target.value;
    const color = event.target.checked ? KOMMUN_COLOR_SELECTED : KOMMUN_COLOR_UNSELECTED;

    // Hämta alla element med kommunens ID (det kan vara enskilda element eller grupperade element)
    const kommuner = document.querySelectorAll(`[id="${kommunKod}"]`);

    kommuner.forEach(kommun => {
        if (kommun.tagName.toLowerCase() === 'g') {
            // Om elementet är en grupp (g), hämta alla polygoner inuti och applicera färg
            const polygons = kommun.querySelectorAll('polygon, path');
            polygons.forEach(polygon => {
                polygon.style.fill = color;
            });
        } else {
            // Om det är ett enskilt polygon-element, ändra dess färg direkt
            kommun.style.fill = color;
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
        showToast(`"${sanitizedStateName}" har sparats med ${checkedCount} kommuner!`, 'success');
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
        showToast(`"${stateName}" har laddats (${checkedCount} kommuner)`, 'success');
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
            showToast(`${loadedStates} av ${totalStates} tillstånd laddades (${checkedCount} kommuner)`, 'success');
        } else {
            showToast('Inga sparade tillstånd hittades.', 'warning');
        }
        updateSelectionCounter();
    } catch (error) {
        console.error('Failed to load multiple states:', error);
        showToast('Kunde inte ladda tillstånden.', 'error');
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
        container.innerHTML = '<p class="no-states">Inga sparade tillstånd</p>';
        return;
    }

    container.innerHTML = states.map(state => {
        const date = state.savedAt ? new Date(state.savedAt).toLocaleDateString('sv-SE') : '';
        return `
            <div class="saved-state-item" data-state="${state.name}">
                <div class="state-info">
                    <span class="state-name">${state.name}</span>
                    <span class="state-meta">${state.checkedCount} kommuner${date ? ' • ' + date : ''}</span>
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
        showToast('Ange ett namn för tillståndet', 'warning');
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
        exportBtn.addEventListener('click', function() {
            exportMap(this);
        });
    }

    // Zoom buttons
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');

    if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);

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
        loadAllBtn.addEventListener('click', function() {
            const states = getSavedStates();
            const stateNames = states.map(s => s.name);
            if (stateNames.length > 0) {
                loadMultipleStates(stateNames, this);
            } else {
                showToast('Inga sparade tillstånd att ladda', 'warning');
            }
        });
    }

    // Initialize saved states list
    updateSavedStatesList();
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

// Ny funktion: justera checkbox-listans layout och höjd så den matchar kartcontainer
function adjustCheckboxListLayout() {
    initializeCache();
    if (!checkboxList) return;

    // Hämta alla labels (kan vara direkt i checkboxList eller i en wrapper)
    const labels = Array.from(checkboxList.querySelectorAll('label'));

    if (labels.length === 0) return;

    // Rensa checkboxList
    checkboxList.innerHTML = '';

    // Hämta checkboxList dimensioner istället för mapContainer
    const rect = checkboxList.getBoundingClientRect();

    // Använd ett rimligt standardvärde om rect.height är 0
    const containerHeight = rect.height > 100 ? rect.height : 400;

    // Uppskatta hur många rader som får plats (ca 32px per rad med padding)
    const rowHeight = 36;
    const maxRows = Math.max(5, Math.floor(containerHeight / rowHeight));

    // Sortera labels alfabetiskt
    labels.sort((a, b) => {
        return a.textContent.localeCompare(b.textContent, 'sv', { sensitivity: 'base' });
    });

    // Beräkna antal kolumner baserat på antal labels och max rader
    const cols = Math.ceil(labels.length / maxRows);
    const rows = Math.ceil(labels.length / cols);

    // Skapa wrapper för horisontell scroll
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '16px';
    wrapper.style.height = '100%';
    wrapper.style.overflowX = 'auto';
    wrapper.style.overflowY = 'hidden';
    wrapper.style.paddingRight = '8px';

    // Skapa kolumner och fyll vertikalt först
    for (let c = 0; c < cols; c++) {
        const colDiv = document.createElement('div');
        colDiv.className = 'checkbox-column';
        colDiv.style.display = 'flex';
        colDiv.style.flexDirection = 'column';
        colDiv.style.gap = '4px';
        colDiv.style.flex = '0 0 auto';
        colDiv.style.minWidth = '160px';

        for (let r = 0; r < rows; r++) {
            const index = r + c * rows;
            if (labels[index]) {
                colDiv.appendChild(labels[index]);
            }
        }

        // Lägg bara till kolumnen om den har innehåll
        if (colDiv.children.length > 0) {
            wrapper.appendChild(colDiv);
        }
    }

    checkboxList.appendChild(wrapper);
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

    switch(key) {
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
document.addEventListener("DOMContentLoaded", function() {
    initializeCache();

    // Anpassa checkbox-layout vid init och vid resize
    adjustCheckboxListLayout();
    window.addEventListener('resize', adjustCheckboxListLayout);

    // double click zoom on the SVG map
    if (svgMapElement) {
        svgMapElement.addEventListener("dblclick", function(event) {
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
        zoomControls.addEventListener('mousedown', function(event) {
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



