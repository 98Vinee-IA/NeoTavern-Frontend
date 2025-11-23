import { sanitizeSelector } from './dom';

const loadedModules = new Set<string>();

export function loadScript(name: string, jsFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `/extensions/${name}/${jsFile}`;
    const id = sanitizeSelector(`${name}-js`);

    if (loadedModules.has(url) || document.getElementById(id)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.type = 'module';
    script.src = url;
    script.async = true;
    script.onload = () => {
      loadedModules.add(url);
      resolve();
    };
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
}

export function unloadScript(name: string) {
  const id = sanitizeSelector(`${name}-js`);
  const script = document.getElementById(id);
  if (script) {
    // Ideally, we keep the script to avoid re-evaluation issues on toggle.
    // However, if we must support "hot reloading" (which is flaky with ESM),
    // we would remove it. For stability, we leave it, or rely on the caller
    // to not call loadScript again for the same URL without a cache buster.
    // Since we track `loadedModules`, we effectively disable repeated loading here.
    // script.remove();
  }
}

export function loadStyle(name: string, cssFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `/extensions/${name}/${cssFile}`;
    const id = sanitizeSelector(`${name}-css`);
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.onload = () => resolve();
    link.onerror = (err) => reject(err);
    document.head.appendChild(link);
  });
}

export function unloadStyle(name: string) {
  const id = sanitizeSelector(`${name}-css`);
  const link = document.getElementById(id);
  if (link) {
    link.remove();
  }
}
