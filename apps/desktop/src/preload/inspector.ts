import { ipcRenderer } from 'electron';

let inspectorActive = false;
let highlightBox: HTMLDivElement | null = null;

ipcRenderer.on('peep:toggle-inspector', (_event, active: boolean) => {
  inspectorActive = active;
  if (!active && highlightBox) {
    highlightBox.remove();
    highlightBox = null;
  }
});

// Highlight elements on hover when inspector is active
document.addEventListener('mousemove', (e) => {
  if (!inspectorActive) return;
  const target = e.target as HTMLElement;
  if (
    !target ||
    target === document.body ||
    target === document.documentElement ||
    target.id === 'peep-inspector-highlight'
  ) {
    return;
  }

  if (!highlightBox) {
    highlightBox = document.createElement('div');
    highlightBox.id = 'peep-inspector-highlight';
    highlightBox.style.position = 'fixed';
    highlightBox.style.border = '2px dashed #ffb703';
    highlightBox.style.background = 'rgba(255, 183, 3, 0.15)';
    highlightBox.style.pointerEvents = 'none';
    highlightBox.style.zIndex = '999999';
    document.body.appendChild(highlightBox);
  }

  const rect = target.getBoundingClientRect();
  highlightBox.style.top = `${rect.top}px`;
  highlightBox.style.left = `${rect.left}px`;
  highlightBox.style.width = `${rect.width}px`;
  highlightBox.style.height = `${rect.height}px`;
});

// Capture selected element metadata on click
document.addEventListener(
  'click',
  (e) => {
    if (!inspectorActive) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (!target) return;

    const metadata = {
      tagName: target.tagName.toLowerCase(),
      className: target.className,
      id: target.id,
      text: target.innerText?.slice(0, 150) || '',
      outerHTML: target.outerHTML.slice(0, 800),
    };

    // Send metadata back to the host <webview> element
    ipcRenderer.sendToHost('peep:element-selected', metadata);

    // Disable inspector mode after selecting an element
    inspectorActive = false;
    if (highlightBox) {
      highlightBox.remove();
      highlightBox = null;
    }
  },
  true // Use capture phase to intercept click before standard handlers execute
);
