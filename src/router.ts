// Simple hash-based router for navigation

type RouteHandler = (params?: Record<string, string>) => void;

interface Route {
  pattern: RegExp;
  handler: RouteHandler;
  paramNames: string[];
}

const routes: Route[] = [];

export function registerRoute(path: string, handler: RouteHandler): void {
  // Convert path pattern to regex and extract parameter names
  const paramNames: string[] = [];
  const pattern = path.replace(/:([^/]+)/g, (_, paramName) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });

  routes.push({
    pattern: new RegExp(`^${pattern}$`),
    handler,
    paramNames
  });
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function getCurrentRoute(): string {
  return window.location.hash.slice(1) || '/';
}

export function initRouter(): void {
  // Handle initial route
  handleRouteChange();

  // Listen for hash changes
  window.addEventListener('hashchange', handleRouteChange);
}

function handleRouteChange(): void {
  const route = getCurrentRoute();

  // Try to match against registered routes
  for (const { pattern, handler, paramNames } of routes) {
    const match = route.match(pattern);
    if (match) {
      // Extract parameters
      const params: Record<string, string> = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });

      handler(params);
      return;
    }
  }

  // No route matched - try to find home route
  const homeRoute = routes.find(r => r.pattern.source === '^/$');
  if (homeRoute) {
    homeRoute.handler();
  }
}
