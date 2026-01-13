import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig(function (_a) {
    var command = _a.command, mode = _a.mode;
    // Load environment variables based on mode
    var isDevelopment = command === 'serve' || mode === 'development';
    var isProduction = command === 'build' && mode === 'production';
    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            port: 3001,
            proxy: {
                '/api': {
                    target: 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                    configure: function (proxy, _options) {
                        proxy.on('error', function (err, _req, res) {
                            console.error('Proxy error details:', {
                                message: err.message,
                                code: err.code,
                                stack: err.stack,
                                method: _req.method,
                                url: _req.url,
                                headers: _req.headers,
                            });
                            try {
                                // Ensure res is a ServerResponse before trying to write to it
                                if ('writeHead' in res && typeof res.writeHead === 'function') {
                                    res.writeHead(500, {
                                        'Content-Type': 'application/json',
                                    });
                                    res.end(JSON.stringify({
                                        error: 'Proxy Error',
                                        message: 'Failed to connect to consolidated backend server',
                                        details: err.message,
                                        timestamp: new Date().toISOString(),
                                    }));
                                }
                            }
                            catch (e) {
                                console.error('Error sending error response:', e);
                            }
                        });
                        proxy.on('proxyReq', function (_proxyReq, req, _res) {
                            console.log('Proxying request:', req.method, req.url);
                            // Log headers
                            console.log('Request headers:', req.headers);
                        });
                    },
                },
            },
        },
        define: {
            // Make environment variables available at build time
            __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
            __BUILD_MODE__: JSON.stringify(mode),
        },
        build: {
            // Different build configurations for different environments
            outDir: 'dist',
            sourcemap: isDevelopment,
            minify: isProduction ? 'terser' : false,
            rollupOptions: {
                output: {
                    manualChunks: isProduction
                        ? {
                            vendor: ['react', 'react-dom'],
                            gemini: ['@google/generative-ai'],
                        }
                        : undefined,
                },
            },
        },
    };
});
