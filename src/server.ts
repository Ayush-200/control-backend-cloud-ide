import express from 'express';
import authRouter from './routes/auth.router.js'
import awsRouter from './routes/aws.router.js';
import projectRouter from './routes/project.router.js';
import proxyRouter from './routes/proxy.router.js';
import 'dotenv/config'
import cors from 'cors';
import http from 'http';

const app = express();
const PORT = process.env.PORT;

// Create HTTP server for WebSocket support
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({extended: true}));
// Handle sendBeacon requests (sent as text/plain)
app.use(express.text({ type: 'text/plain' }));
app.use(cors({
    origin: process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000', 
    methods: ["GET", "POST", "DELETE", "PUT"]
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

app.use('/auth', authRouter);
app.use('/aws', awsRouter);
app.use('/api', projectRouter);
app.use('/output', proxyRouter);

// 404 handler
app.use((req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
});

// WebSocket upgrade handler for HMR support
server.on('upgrade', (req, socket, head) => {
    console.log('WebSocket upgrade request:', req.url);
    
    const urlParts = req.url?.split('/');
    
    if (urlParts && urlParts.length >= 4 && urlParts[1] === 'output') {
        const sessionId = urlParts[2];
        const port = urlParts[3];
        
        console.log(`WebSocket upgrade for session ${sessionId}, port ${port}`);
        
        // Import proxy cache from controller
        // Note: This is a simplified approach. In production, you might want to
        // create a shared cache or use a different approach
        const cacheKey = `${sessionId}:*:${port}`;
        
        // For now, we'll let the proxy middleware handle WebSocket upgrades
        // The actual proxy instance will be created when the first HTTP request comes in
        console.log(`WebSocket upgrade will be handled by proxy middleware`);
    }
});

server.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`=================================`);
    console.log('Available routes:');
    console.log('  POST /auth/login');
    console.log('  POST /auth/signup');
    console.log('  POST /auth/user');
    console.log('  POST /auth/refresh');
    console.log('  POST /aws/startSession');
    console.log('  POST /aws/stopSession');
    console.log('  GET  /api/projects');
    console.log('  POST /api/projects');
    console.log('  DELETE /api/projects');
    console.log('  ALL  /output/:sessionId/:port/* (proxy to container)');
    console.log(`=================================`);
});
