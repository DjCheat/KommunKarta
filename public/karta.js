// karta.js

// Hämta SVG-elementet för kartan (used for initial injection)
const svgMap = document.getElementById('sweden-map');

// Hämta checkboxlistan
const checkboxList = document.getElementById('checkbox-list');

// Läs in kommundata från JSON-filen
fetch('kommuner.json')
    .then(response => response.json())
    .then(data => {
        // Hämta SVG-filen med kommunkoderna
        fetch('kommunKarta.svg')
            .then(response => response.text())
            .then(svgData => {
                // Lägg till SVG-filen i dokumentet
                svgMap.innerHTML = svgData;

                // Hämta kommunkoderna i ordning från JSON-data och sortera dem i bokstavsordning (svenska)
                const kommunKoder = Object.keys(data).sort((a, b) => {
                    const kommunNamnA = data[a] || '';
                    const kommunNamnB = data[b] || '';
                    // Use Swedish locale so å/ä/ö sorteras correctly
                    return kommunNamnA.localeCompare(kommunNamnB, 'sv', { sensitivity: 'base' });
                });

                // Förbered 5 kolumner i checkbox-listan (horisontellt scrollbar container)
                checkboxList.innerHTML = ''; // rensa tidigare innehåll
                const columns = [];
                for (let i = 0; i < 5; i++) {
                    const col = document.createElement('div');
                    col.className = 'checkbox-column';
                    // ensure fixed visible 5 columns (20% each)
                    col.style.flex = '0 0 20%';
                    col.style.boxSizing = 'border-box';
                    columns.push(col);
                    checkboxList.appendChild(col);
                }

                // Hjälpfunktion: bestäm kolumn baserat på första bokstaven (svenska grupper A-E, F-J, K-O, P-T, U-Ö)
                function getColumnIndexByName(name) {
                    if (!name || typeof name !== 'string') return 0;
                    const first = name.trim().charAt(0).toUpperCase();
                    if (first >= 'A' && first <= 'E') return 0;
                    if (first >= 'F' && first <= 'J') return 1;
                    if (first >= 'K' && first <= 'O') return 2;
                    if (first >= 'P' && first <= 'T') return 3;
                    // U..Z and Swedish Å/Ä/Ö go to last column
                    return 4;
                }

                 // Center the map in the container on page load
                 setTimeout(() => {
                     centerMapInContainer();
                 }, 100);
 
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
                         const label = document.createElement('label');
-                        label.htmlFor = kommunKod;
-                        label.textContent = kommunNamn;
+                        label.htmlFor = kommunKod;
+                        // sätt text efter checkbox så layout blir rätt i flexbox-kolumnen
+                        const textNode = document.createTextNode(kommunNamn);
                         label.style.cursor = 'pointer'; // Make it clear the label is clickable
                         label.style.userSelect = 'none'; // Prevent text selection when clicking
 
                         const checkbox = document.createElement('input');
                         checkbox.type = 'checkbox';
                         checkbox.value = kommunKod;
                         checkbox.id = kommunKod;
                         checkbox.addEventListener('change', toggleKommunColor);
 
                         // Restore saved state if any
                         if (savedCheckboxState[kommunKod]) {
                             checkbox.checked = true;
                         }
 
                         // Add click event to label as backup to ensure it works
                         label.addEventListener('click', function(event) {
                             // Only trigger if the click wasn't on the checkbox itself
                             if (event.target !== checkbox) {
                                 checkbox.checked = !checkbox.checked;
                                 toggleKommunColor({ target: checkbox });
                             }
                         });
 
                         // Insert checkbox before text content for better layout
-                        label.insertBefore(checkbox, label.firstChild);
-                        checkboxList.appendChild(label);
+                        label.appendChild(checkbox);
+                        label.appendChild(textNode);
+                        // placera i rätt kolumn enligt första bokstav
+                        const colIndex = getColumnIndexByName(kommunNamn);
+                        columns[colIndex].appendChild(label);
 
                         // Uppdatera kommunens färg baserat på checkboxens tillstånd
                         toggleKommunColor({ target: checkbox });
                     }
                 });
 
-                // Anpassa layouten för checkbox-listan efter att alla checkboxar har skapats
-                adjustCheckboxListLayout();
+                // Anpassa layouten för checkbox-listan efter att alla checkboxar har skapats
+                adjustCheckboxListLayout();
  
              })
              .catch(error => console.error('Error fetching SVG file:', error));
      })
      .catch(error => console.error('Error fetching JSON file:', error));


// Funktion för att ändra färg på kommun baserat på checkboxstatus
function toggleKommunColor(event) {
    const kommunKod = event.target.value;

    // Hämta alla element med kommunens ID (det kan vara enskilda element eller grupperade element)
    const kommuner = document.querySelectorAll(`[id="${kommunKod}"]`);

    kommuner.forEach(kommun => {
        if (kommun.tagName.toLowerCase() === 'g') {
            // Om elementet är en grupp (g), hämta alla polygoner inuti och applicera färg
            const polygons = kommun.querySelectorAll('polygon, path'); // För att inkludera både polygoner och paths
            polygons.forEach(polygon => {
                if (event.target.checked) {
                    polygon.style.fill = '#138943'; // Ändra färgen på markerade polygoner
                } else {
                    polygon.style.fill = '#ccc'; // Återställ färgen till standard
                }
            });
        } else {
            // Om det är ett enskilt polygon-element, ändra dess färg direkt
            if (event.target.checked) {
                kommun.style.fill = '#138943';
            } else {
                kommun.style.fill = '#ccc';
            }
        }
    });

    // Persist each checkbox change in a simple global state
    saveCheckboxState(event.target.id, event.target.checked);
}


// Funktion för att avmarkera alla checkboxar och återställa färgen på alla kommuner
function uncheckAllCheckboxes() {
    const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.checked = false;

        // Hämta kommunens element
        let kommun = document.getElementById(checkbox.value);
        
        if (kommun) {
            // Om kommunen är en grupp (<g>), återställ färgen för hela gruppen
            if (kommun.tagName.toLowerCase() === 'g') {
                kommun.style.fill = '#ccc'; // Återställ färgen till grå
                // Återställ även färgen för alla polygoner inom gruppen
                const polygons = kommun.querySelectorAll('polygon');
                polygons.forEach(polygon => {
                    polygon.style.fill = '#ccc'; // Återställ färgen till grå
                });
            } else {
                // Om det inte är en grupp, återställ färgen för det enskilda objektet
                kommun.style.fill = '#ccc';
            }
        }
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
function saveCheckboxState(kommunKod, isChecked) {
    const checkboxState = JSON.parse(localStorage.getItem('checkboxState')) || {};
    checkboxState[kommunKod] = isChecked;
    localStorage.setItem('checkboxState', JSON.stringify(checkboxState));
}


// Funktion för att spara en uppsättning checkbox-tillstånd med ett visst namn
function saveState(stateName) {
    // Validate state name
    if (!stateName || typeof stateName !== 'string' || stateName.trim().length === 0) {
        alert('Invalid state name. Please provide a valid name.');
        return;
    }
    
    // Sanitize state name to prevent XSS
    const sanitizedStateName = stateName.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    if (sanitizedStateName !== stateName.trim()) {
        alert('State name contains invalid characters. Only letters, numbers, and spaces are allowed.');
        return;
    }
    
    try {
        const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
        const checkboxState = {};
        checkboxes.forEach(checkbox => {
            checkboxState[checkbox.id] = checkbox.checked;
        });
        localStorage.setItem(sanitizedStateName, JSON.stringify(checkboxState));
        alert(`State '${sanitizedStateName}' has been saved!`);
    } catch (error) {
        console.error('Failed to save state:', error);
        alert('Failed to save state. Please try again or check if you have enough storage space.');
    }
}

// Funktion för att ladda en uppsättning checkbox-tillstånd med ett visst namn
function loadState(stateName) {
    // Validate state name
    if (!stateName || typeof stateName !== 'string' || stateName.trim().length === 0) {
        alert('Invalid state name. Please provide a valid name.');
        return;
    }
    
    try {
        const savedData = localStorage.getItem(stateName);
        if (!savedData) {
            alert(`State '${stateName}' not found in storage.`);
            return;
        }
        
        const savedCheckboxState = JSON.parse(savedData);
        const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = savedCheckboxState[checkbox.id] || false;
            // Uppdatera färgen på kommunerna baserat på checkbox-tillstånd
            const event = new Event('change');
            checkbox.dispatchEvent(event);
        });
        alert(`State '${stateName}' has been loaded!`);
    } catch (error) {
        console.error('Failed to load state:', error);
        alert('Failed to load state. The saved data might be corrupted.');
    }
}

// Funktion för att ladda flera tillstånd och kombinera dem
function loadMultipleStates(stateNames) {
    if (!Array.isArray(stateNames) || stateNames.length === 0) {
        alert('Invalid state names array.');
        return;
    }
    
    let combinedCheckboxState = {};
    let loadedStates = 0;
    let totalStates = stateNames.length;

    try {
        // Iterera genom varje stateName och kombinera checkbox-tillstånden
        stateNames.forEach(stateName => {
            if (typeof stateName !== 'string' || stateName.trim().length === 0) {
                console.warn(`Invalid state name: ${stateName}`);
                return;
            }
            
            const savedData = localStorage.getItem(stateName);
            if (savedData) {
                try {
                    const savedCheckboxState = JSON.parse(savedData);
                    loadedStates++;
                    // Slå ihop checkbox-tillstånd (True om någon av tillstånden är true)
                    Object.keys(savedCheckboxState).forEach(kommunKod => {
                        combinedCheckboxState[kommunKod] = combinedCheckboxState[kommunKod] || savedCheckboxState[kommunKod];
                    });
                } catch (parseError) {
                    console.error(`Failed to parse state ${stateName}:`, parseError);
                }
            } else {
                console.warn(`State '${stateName}' not found in storage.`);
            }
        });

        // Applicera det kombinerade tillståndet på alla checkboxar
        const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = combinedCheckboxState[checkbox.id] || false;
            // Uppdatera färgen på kommunerna baserat på checkbox-tillstånd
            const event = new Event('change');
            checkbox.dispatchEvent(event);
        });

        if (loadedStates > 0) {
            alert(`${loadedStates} out of ${totalStates} states have been loaded and applied!`);
        } else {
            alert('No valid states found to load.');
        }
    } catch (error) {
        console.error('Failed to load multiple states:', error);
        alert('Failed to load states. Please try again.');
    }
}

// Removed auto-execution - states should only load when user clicks the button

// Event listener för att ladda flera tillstånd när knappen klickas
const loadAllBtn = document.getElementById('load-all-states-btn');
if (loadAllBtn) {
    loadAllBtn.addEventListener('click', function() {
        loadMultipleStates(['Vision', 'Future', 'Mobile']);
    });
}


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
    if (!checkboxList || !mapContainerElement) return;

    const rect = mapContainerElement.getBoundingClientRect();

    // Sätt höjd så att listan matchar kartans container och får scrollbar vid behov
    checkboxList.style.height = rect.height + 'px';
    checkboxList.style.overflowY = 'auto';

    // Responsiv grid – antal kolumner baserat på containerbredd
    const approxColWidth = 260; // justera efter önskat utseende
    const cols = Math.max(1, Math.floor(rect.width / approxColWidth));
    checkboxList.style.display = 'grid';
    checkboxList.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    checkboxList.style.gap = '6px 12px';

    // Se till att varje label radbryts och har bra inre layout
    const labels = checkboxList.querySelectorAll('label');
    labels.forEach(l => {
        l.style.display = 'flex';
        l.style.alignItems = 'center';
        l.style.gap = '8px';
        l.style.whiteSpace = 'normal';
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

// Function to center the map in the container
function centerMapInContainer() {
    initializeCache();
    if (svgMapElement && mapContainerElement) {
        // Reset any existing transformations
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        
        // Get container dimensions
        const containerRect = mapContainerElement.getBoundingClientRect();
        const svgRect = svgMapElement.getBoundingClientRect();
        
        // Calculate center offsets (unscaled pixel offsets)
        const centerX = (containerRect.width - svgRect.width) / 2;
        const centerY = (containerRect.height - svgRect.height) / 2;
        
        // Apply centering
        offsetX = centerX;
        offsetY = centerY;
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
function exportMap() {
    initializeCache();
    
    if (!svgMapElement) {
        alert('Map element not found. Cannot export.');
        return;
    }
    
    try {
        // Spara nuvarande transformation
        var currentScale = scale;
        var currentOffsetX = offsetX;
        var currentOffsetY = offsetY;

        // Återställ kartan till ursprunglig vy
        resetView();

        // Vänta på att återställningen ska slå igenom
        setTimeout(function() {
            try {
                // Skapa en kopia av SVG-elementet
                var svgCopy = svgMapElement.cloneNode(true);
                
                // Hämta bounding box av kartan
                var bbox = svgMapElement.getBBox();

                // Sätt viewBox så att det bara omfattar kartan och lite vitt utrymme runtom
                var padding = 20; // Justera padding efter behov
                svgCopy.setAttribute("viewBox", (bbox.x - padding) + " " + (bbox.y - padding) + " " + (bbox.width + 2 * padding) + " " + (bbox.height + 2 * padding));
                
                // Skapa en SVG-sträng från kopian av SVG-elementet
                var svgString = new XMLSerializer().serializeToString(svgCopy);

                // Skapa en Blob med den nya SVG-strängen
                var blob = new Blob([svgString], { type: "image/svg+xml" });

                // Skapa en URL från Blob
                var url = URL.createObjectURL(blob);

                // Skapa en länk för att ladda ner SVG-filen
                var a = document.createElement("a");
                a.href = url;
                a.download = "sweden-map.svg";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Återkalla URL:en
                URL.revokeObjectURL(url);

                // Återställ tidigare transformation
                scale = currentScale;
                offsetX = currentOffsetX;
                offsetY = currentOffsetY;
                updateTransform();
                
                alert('Map exported successfully!');
            } catch (exportError) {
                console.error('Export failed:', exportError);
                alert('Failed to export map. Please try again.');
                
                // Restore view even if export failed
                scale = currentScale;
                offsetX = currentOffsetX;
                offsetY = currentOffsetY;
                updateTransform();
            }
        }, 100);
    } catch (error) {
        console.error('Export initialization failed:', error);
        alert('Failed to initialize export. Please try again.');
    }
}
