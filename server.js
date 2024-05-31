const express = require('express');
const app = express();
const path = require('path');

// Ange en port för servern
const PORT = process.env.PORT || 3000;

// Ange statisk sökväg för att serva statiska filer (HTML, CSS, JS, SVG, JSON)
app.use(express.static(path.join(__dirname, 'public')));

// Starta servern
app.listen(PORT, () => {
    console.log(`Servern är igång på port ${PORT}`);
});
