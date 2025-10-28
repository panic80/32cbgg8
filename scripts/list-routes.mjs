process.env.NODE_ENV = 'test';
const { app } = await import('../server/app.js');
const routes = [];
for (const layer of app._router.stack) {
  if (layer.route && layer.route.path) {
    const methods = Object.keys(layer.route.methods)
      .map((m) => m.toUpperCase())
      .join(',');
    routes.push(`${methods} ${layer.route.path}`);
  } else if (layer.name === 'router' && layer.handle?.stack) {
    for (const handler of layer.handle.stack) {
      if (handler.route && handler.route.path) {
        const methods = Object.keys(handler.route.methods)
          .map((m) => m.toUpperCase())
          .join(',');
        routes.push(`${methods} ${handler.route.path}`);
      }
    }
  }
}
console.log(routes);
