const express = require('express');
const app = express();
const path = require('path');

// Ange en port för servern
const PORT = process.env.PORT || 3000;

// Security headers and CORS
app.use((req, res, next) => {
    // CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Security headers
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('X-XSS-Protection', '1; mode=block');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Rate limiting (basic implementation)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

app.use((req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!rateLimitMap.has(clientIP)) {
        rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else {
        const limit = rateLimitMap.get(clientIP);
        if (now > limit.resetTime) {
            limit.count = 1;
            limit.resetTime = now + RATE_LIMIT_WINDOW;
        } else {
            limit.count++;
            if (limit.count > RATE_LIMIT_MAX_REQUESTS) {
                return res.status(429).json({ error: 'Too many requests. Please try again later.' });
            }
        }
    }
    next();
});

// Ange statisk sökväg för att serva statiska filer (HTML, CSS, JS, SVG, JSON)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'karta.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Starta servern
app.listen(PORT, () => {
    console.log(`Servern är igång på port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
