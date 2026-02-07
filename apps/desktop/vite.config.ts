import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Plugin to fix HTML for Electron compatibility (production only)
function electronCompatPlugin(): Plugin {
  return {
    name: 'electron-compat',
    enforce: 'post',
    apply: 'build', // Only apply during build, not dev server
    transformIndexHtml(html) {
      // Remove crossorigin attribute and type="module", add defer for file:// protocol
      // Dynamically load the main JS since <script defer> doesn't work with file:// protocol
      const loaderScript = `<script>
(function() {
  var scriptTag = document.querySelector('script[src*="assets/index"]');
  if (scriptTag) {
    var src = scriptTag.getAttribute('src');
    scriptTag.remove();
    fetch(src)
      .then(function(r) { return r.text(); })
      .then(function(code) {
        var script = document.createElement('script');
        script.textContent = code;
        document.body.appendChild(script);
      })
      .catch(function(e) { console.error('Failed to load app:', e); });
  }
})();
</script>`;
      return html
        .replace(/ crossorigin/g, '')
        .replace(/ type="module"/g, '')
        .replace(/<script src="/g, '<script defer src="')
        .replace('</body>', loaderScript + '</body>');
    },
  };
}

export default defineConfig({
  plugins: [react(), electronCompatPlugin()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    modulePreload: false,
    // Use legacy format for Electron compatibility
    target: 'esnext',
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/[name]-[hash].js',
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@envoy/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@envoy/database-core': path.resolve(__dirname, '../../packages/database-core/src'),
    },
  },
  server: {
    port: 5173,
  },
});
