/**
 * Inspector preload script — injected into the preview iframe via a <script> tag
 * embedded in the HTML served by the dev server, OR via the iframe's srcdoc.
 *
 * Since we switched from <webview> (OOP) to <iframe> (same-process), communication
 * now uses window.postMessage instead of ipcRenderer.sendToHost.
 *
 * The host (PreviewPane) sends:   { type: 'peep:toggle-inspector', active: boolean }
 * The guest (this script) replies: { type: 'peep:element-selected', metadata: {...} }
 */

let inspectorActive = false;
let highlightBox: HTMLDivElement | null = null;

// Receive toggle command from the host frame
window.addEventListener('message', (e: MessageEvent) => {
  if (!e.data || typeof e.data !== 'object') return;
  if (e.data.type === 'peep:toggle-inspector') {
    inspectorActive = !!e.data.active;
    if (!inspectorActive && highlightBox) {
      highlightBox.remove();
      highlightBox = null;
    }
  }
});

// Highlight hovered element while inspector is active
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

function findReactFiber(element: any) {
  const keys = Object.keys(element);
  for (const key of keys) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
      return element[key];
    }
  }
  return null;
}

interface ComponentSourceInfo {
  name: string;
  file?: string;
  line?: number;
  column?: number;
  props?: any;
}

function getFiberSourceInfo(fiber: any): ComponentSourceInfo | null {
  if (!fiber) return null;

  let name = 'UnknownComponent';
  if (typeof fiber.type === 'string') {
    name = fiber.type;
  } else if (fiber.type && typeof fiber.type === 'function') {
    name = fiber.type.name || fiber.type.displayName || 'FunctionComponent';
  } else if (fiber.type && fiber.type.$$typeof) {
    const typeObj = fiber.type;
    const innerType = typeObj.render || typeObj.type;
    name = (innerType ? (innerType.name || innerType.displayName) : '') || 'MemoOrForwardRef';
  } else if (fiber.elementType && typeof fiber.elementType === 'function') {
    name = fiber.elementType.name || 'Component';
  }

  const info: ComponentSourceInfo = { name };

  if (fiber._debugSource) {
    info.file = fiber._debugSource.fileName;
    info.line = fiber._debugSource.lineNumber;
    info.column = fiber._debugSource.columnNumber;
  }

  if (fiber.memoizedProps) {
    info.props = {};
    const keysToExtract = ['id', 'title', 'label', 'name', 'testID', 'accessibilityLabel'];
    for (const key of keysToExtract) {
      if (fiber.memoizedProps[key] !== undefined) {
        info.props[key] = fiber.memoizedProps[key];
      }
    }
    if (fiber.memoizedProps.style) {
      info.props.style = fiber.memoizedProps.style;
    }
  }

  return info;
}

function traverseFiberTree(element: HTMLElement): ComponentSourceInfo[] {
  let fiber = findReactFiber(element);
  const hierarchy: ComponentSourceInfo[] = [];

  while (fiber) {
    const info = getFiberSourceInfo(fiber);
    if (info) {
      hierarchy.push(info);
    }
    fiber = fiber.return;
  }
  return hierarchy;
}

// Capture selected element metadata on click
document.addEventListener(
  'click',
  (e) => {
    if (!inspectorActive) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    if (!target) return;

    const hierarchy = traverseFiberTree(target);
    const primaryComponent = hierarchy.find(h => h.file) || hierarchy[0];

    const metadata = {
      framework: hierarchy.length > 0 ? 'react-native-web' : 'unknown',
      componentName: primaryComponent?.name || 'UnknownComponent',
      sourceFile: primaryComponent?.file || undefined,
      sourceLine: primaryComponent?.line || undefined,
      sourceColumn: primaryComponent?.column || undefined,
      componentHierarchy: hierarchy.map(h => h.name),
      props: primaryComponent?.props || undefined,
      elementInfo: {
        tagName: target.tagName.toLowerCase(),
        className: target.className,
        id: target.id,
        text: target.innerText?.slice(0, 150) || '',
      }
    };

    // Send metadata to the host window via postMessage
    window.parent.postMessage({ type: 'peep:element-selected', metadata }, '*');

    // Disable inspector after selecting
    inspectorActive = false;
    if (highlightBox) {
      highlightBox.remove();
      highlightBox = null;
    }
  },
  true // capture phase — intercept before standard handlers
);
