// karta.js

// Hämta SVG-elementet för kartan
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

                // Hämta kommunkoderna i ordning från JSON-data och sortera dem i bokstavsordning
                const kommunKoder = Object.keys(data).sort((a, b) => {
                    const kommunNamnA = data[a].toLowerCase();
                    const kommunNamnB = data[b].toLowerCase();
                    return kommunNamnA.localeCompare(kommunNamnB);
                });

                // Återställ checkbox-tillstånd från localStorage
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
                        label.htmlFor = kommunKod;
                        label.textContent = kommunNamn;

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = kommunKod;
                        checkbox.id = kommunKod;
                        checkbox.addEventListener('change', toggleKommunColor);

                        label.appendChild(checkbox); // Lägg till checkboxen inuti label-elementet
                        checkboxList.appendChild(label);

                        // Uppdatera kommunens färg baserat på checkboxens tillstånd
                        toggleKommunColor({ target: checkbox });     
                    }
                });
            })
            .catch(error => console.error('Error fetching SVG file:', error));
    })
    .catch(error => console.error('Error fetching JSON file:', error));

/*
// Funktion för att ändra färg på kommun baserat på checkboxstatus
function toggleKommunColor(event) {
    const kommunKod = event.target.value;
    const kommun = document.getElementById(kommunKod);
    if (event.target.checked) {
        // Ändra färgen på markerad kommun
        kommun.style.fill = '#138943';
    } else {
        // Återställ färgen på avmarkerad kommun
        kommun.style.fill = '#ccc'; // Återställ färgen till standard
    }
}
*/


// Funktion för att ändra färg på kommun baserat på checkboxstatus
function toggleKommunColor(event) {
    const kommunKod = event.target.value;

    // Hämta alla element med kommunens ID (det kan vara enskilda element eller grupperade element)
    const kommuner = document.querySelectorAll(`[id="${kommunKod}"]`);

    kommuner.forEach(kommun => {
        if (kommun.tagName === 'g') {
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
    const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
    const checkboxState = {};
    checkboxes.forEach(checkbox => {
        checkboxState[checkbox.id] = checkbox.checked;
    });
    localStorage.setItem(stateName, JSON.stringify(checkboxState));
    alert(`State '${stateName}' has been saved!`);
}

// Funktion för att ladda en uppsättning checkbox-tillstånd med ett visst namn
function loadState(stateName) {
    const savedCheckboxState = JSON.parse(localStorage.getItem(stateName)) || {};
    const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = savedCheckboxState[checkbox.id] || false;
        // Uppdatera färgen på kommunerna baserat på checkbox-tillstånd
        const event = new Event('change');
        checkbox.dispatchEvent(event);
    });
    alert(`State '${stateName}' has been loaded!`);
}

// Funktion för att ladda flera tillstånd och kombinera dem
function loadMultipleStates(stateNames) {
    let combinedCheckboxState = {};

    // Iterera genom varje stateName och kombinera checkbox-tillstånden
    stateNames.forEach(stateName => {
        const savedCheckboxState = JSON.parse(localStorage.getItem(stateName)) || {};
        // Slå ihop checkbox-tillstånd (True om någon av tillstånden är true)
        Object.keys(savedCheckboxState).forEach(kommunKod => {
            combinedCheckboxState[kommunKod] = combinedCheckboxState[kommunKod] || savedCheckboxState[kommunKod];
        });
    });

    // Applicera det kombinerade tillståndet på alla checkboxar
    const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = combinedCheckboxState[checkbox.id] || false;
        // Uppdatera färgen på kommunerna baserat på checkbox-tillstånd
        const event = new Event('change');
        checkbox.dispatchEvent(event);
    });

    alert(`All states have been loaded and applied!`);
}

// Använd funktionen genom att specificera vilka tillstånd som ska laddas
const stateNames = ['Vision', 'Future', 'Mobile'];
loadMultipleStates(stateNames);


// Event listener för att ladda flera tillstånd när knappen klickas
document.getElementById('load-all-states-btn').addEventListener('click', function() {
    loadMultipleStates(['Vision', 'Future', 'Mobile']);
});



// ZOOM-FUNKTONER

// Variabler för zoomnivå och position
let scale = 1;
let offsetX = 0;
let offsetY = 0;


// Funktion för att uppdatera transformeringen (zoom och panorering)
function updateTransform() {
    var transformValue = "scale(" + scale + ") translate(" + offsetX + "px, " + offsetY + "px)";
    document.getElementById("sweden-map").style.transform = transformValue;
}


// Funktion för att zooma in
function zoomIn() {
    scale += 0.5;
    updateTransform();
}

// Funktion för att zooma ut
function zoomOut() {
    scale -= 0.5;
    updateTransform();
}

// Funktion för att zooma in genom dubbelklick
function zoomInOnDoubleClick(event) {
    zoomIn();
    scale *= 1.5; // Öka skalan med 50%
    updateTransform();
}

// Funktion för att zooma ut genom dubbelklick
function zoomOutOnDoubleClick(event) {
    zoomOut();
    scale *= 0.5; // Minska skalan med 50%
    updateTransform();
}


// Lyssna på dubbelklickshändelser på kartan och zooma in eller ut beroende på dubbelklicksåtgärden
document.getElementById("sweden-map").addEventListener("dblclick", function(event) {
    if (event.ctrlKey) {
        zoomOutOnDoubleClick(event);
    } else {
        zoomInOnDoubleClick(event);
    }
});



// Funktion för att panorera kartan
function panMap(dx, dy) {
    offsetX += dx;
    offsetY += dy;
    updateTransform();
  }
  
  // Variabler för att spara startpositionen vid klick
  var isDragging = false;
  var startX = 0;
  var startY = 0;
  var startOffsetX = 0;
  var startOffsetY = 0;
  
  // Funktion för att börja panorera
  function startPan(event) {
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
  }
  
  // Funktion för att panorera kartan
  function panMap(event) {
    if (isDragging) {
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      offsetX = startOffsetX + dx;
      offsetY = startOffsetY + dy;
      updateTransform();
    }
  }
  
  // Funktion för att avsluta panorering
  function endPan() {
    isDragging = false;
  }
  
  // Lyssna på musknapptryck för att börja panorering
  document.getElementById("mapContainer").addEventListener("mousedown", startPan);
  
  // Lyssna på musrörelse för att panorera
  document.addEventListener("mousemove", panMap);
  
  // Lyssna på musknappsläpp för att avsluta panorering
  document.addEventListener("mouseup", endPan);









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
    // Spara nuvarande transformation
    var currentScale = scale;
    var currentOffsetX = offsetX;
    var currentOffsetY = offsetY;

    // Återställ kartan till ursprunglig vy
    resetView();

    // Vänta på att återställningen ska slå igenom
    setTimeout(function() {
        // Hämta SVG-elementet
        var svgElement = document.getElementById("sweden-map");

        // Skapa en kopia av SVG-elementet
        var svgCopy = svgElement.cloneNode(true);
        
        // Hämta bounding box av kartan
        var bbox = svgElement.getBBox();

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
    }, 100);

// Lägg till en EventListener för att uppdatera procentandelen när en checkbox ändras
checkboxList.addEventListener('change', updateSelectedPercentage);

// Skapa ett nytt element för att visa procentandelen
const percentageDisplay = document.createElement('div');
percentageDisplay.id = 'percentage-display';
percentageDisplay.style.marginTop = '10px';
checkboxList.parentNode.insertBefore(percentageDisplay, checkboxList.nextSibling);

// Uppdatera procentandelen när sidan laddas
updateSelectedPercentage();

// Funktion för att uppdatera procentandelen markerade kommuner
function updateSelectedPercentage() {
    const checkboxes = checkboxList.querySelectorAll('input[type="checkbox"]');
    const totalCheckboxes = checkboxes.length;
    const checkedCheckboxes = Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
    const percentage = (checkedCheckboxes / totalCheckboxes) * 100;

    // Debug logs
    console.log('Total checkboxes:', totalCheckboxes);
    console.log('Checked checkboxes:', checkedCheckboxes);
    console.log('Calculated percentage:', percentage);

    // Visa procentandelen i elementet
    percentageDisplay.textContent = `Valda kommuner: ${percentage.toFixed(2)}%`;
}

// Lägg till uppdatering av procentandelen när checkboxarna skapas
function createCheckbox(kommunKod, kommunNamn) {
    const label = document.createElement('label');
    label.htmlFor = kommunKod;
    label.textContent = kommunNamn;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = kommunKod;
    checkbox.id = kommunKod;

    // Lägg till eventlyssnare för varje checkbox
    checkbox.addEventListener('change', function(event) {
        console.log('Checkbox changed:', event.target.id, event.target.checked);
        toggleKommunColor(event);
        updateSelectedPercentage();
    });

    label.appendChild(checkbox);
    checkboxList.appendChild(label);

    // Uppdatera färgen på kommunerna baserat på checkbox-tillstånd
    const event = new Event('change');
    checkbox.dispatchEvent(event);
}

// När checkboxarna skapas, anropa createCheckbox för att lägga till eventlyssnare
kommunKoder.forEach(kommunKod => {
    const kommunNamn = data[kommunKod];
    createCheckbox(kommunKod, kommunNamn);
});
    
}
