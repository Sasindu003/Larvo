/**
 * Client-Side Behavior Tracking Engine for Larvo
 * Captures clicks, page navigations, and client capabilities with batching & beacon support.
 */

export interface TrackedEvent {
  sessionId: string;
  deviceId: string;
  eventType: 'click' | 'page_view' | 'navigation' | 'form_submit' | 'custom';
  page: {
    path: string;
    url: string;
    title: string;
    referrer: string;
  };
  target?: {
    tagName: string;
    id: string;
    className: string;
    innerText: string;
    selector: string;
    href?: string;
    ariaLabel?: string;
    coords?: {
      x: number;
      y: number;
    };
  };
  screenResolution: string;
  viewport: string;
  language: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

class TrackerService {
  private queue: TrackedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_BATCH_SIZE = 10;
  private readonly FLUSH_INTERVAL_MS = 3000;
  private deviceId: string;
  private sessionId: string;
  private apiUrl: string;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.sessionId = this.getOrCreateSessionId();
    this.apiUrl = this.resolveApiUrl();

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush(true);
        }
      });
      window.addEventListener('pagehide', () => this.flush(true));
      window.addEventListener('beforeunload', () => this.flush(true));

      // Global capture-phase click tracker
      document.addEventListener('click', (e) => this.trackClick(e), { capture: true, passive: true });

      // Global bulletproof shortcut listener: Ctrl + Shift + Z (and Cmd + Shift + Z)
      window.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
          const isZ = e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z';
          const isCtrl = e.ctrlKey || e.metaKey;
          if (isCtrl && e.shiftKey && isZ) {
            e.preventDefault();
            e.stopPropagation();
            window.location.href = '/admin/tracking';
          }
        },
        true
      );
    }
  }

  private resolveApiUrl(): string {
    if (typeof window === 'undefined') return '/api';
    const isVercel =
      window.location.hostname.endsWith('.vercel.app') ||
      window.location.hostname === 'larvo-client.vercel.app';
    const configured = (import.meta as any).env?.VITE_API_URL;
    if (isVercel && (!configured || configured.includes('larvo-server.vercel.app'))) {
      return '/api';
    }
    return configured || '/api';
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return 'server';
    try {
      let id = localStorage.getItem('larvo_device_id');
      if (!id) {
        id = this.generateUUID();
        localStorage.setItem('larvo_device_id', id);
      }
      return id;
    } catch {
      return this.generateUUID();
    }
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return 'server';
    try {
      let id = sessionStorage.getItem('larvo_session_id');
      if (!id) {
        id = this.generateUUID();
        sessionStorage.setItem('larvo_session_id', id);
      }
      return id;
    } catch {
      return this.generateUUID();
    }
  }

  private getClientCapabilities() {
    if (typeof window === 'undefined') {
      return {
        screenResolution: 'unknown',
        viewport: 'unknown',
        language: 'en',
      };
    }
    return {
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language || 'en',
    };
  }

  /**
   * Sanitize element innerText to ensure passwords/credit cards are never captured
   */
  private sanitizeText(raw: string, isSensitiveField = false): string {
    if (!raw) return '';
    if (isSensitiveField) return '[REDACTED]';

    let text = raw.trim().replace(/\s+/g, ' ');
    // Mask potential credit card patterns (13-19 digits)
    text = text.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_CARD]');
    // Mask email addresses if appearing inside button text
    text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');

    if (text.length > 150) {
      return text.slice(0, 150) + '...';
    }
    return text;
  }

  /**
   * Derive a concise CSS selector for the target element
   */
  private getCssSelector(el: HTMLElement): string {
    const parts: string[] = [];
    let curr: HTMLElement | null = el;
    let depth = 0;

    while (curr && curr !== document.body && depth < 3) {
      let part = curr.tagName.toLowerCase();
      if (curr.id) {
        part += `#${curr.id}`;
        parts.unshift(part);
        break;
      }
      if (curr.classList && curr.classList.length > 0) {
        const firstClass = curr.classList[0];
        if (firstClass && !firstClass.startsWith('lucide')) {
          part += `.${firstClass}`;
        }
      }
      parts.unshift(part);
      curr = curr.parentElement;
      depth++;
    }

    return parts.join(' > ') || el.tagName.toLowerCase();
  }

  /**
   * Track single click event anywhere in DOM
   */
  public trackClick(e: MouseEvent): void {
    if (!e.target || !(e.target instanceof HTMLElement)) return;

    const rawTarget = e.target;
    // Find closest interactive element
    const interactive = rawTarget.closest<HTMLElement>(
      'button, a, input, select, textarea, [role="button"], [data-track]'
    );
    const target = interactive || rawTarget;

    const isPassword =
      target instanceof HTMLInputElement &&
      (target.type === 'password' || target.name.toLowerCase().includes('password'));

    const rawText = target.innerText || target.getAttribute('aria-label') || (target as any).value || '';
    const innerText = this.sanitizeText(rawText, isPassword);
    const tagName = target.tagName || '';
    const id = target.id || '';
    const className = typeof target.className === 'string' ? target.className.slice(0, 300) : '';
    const selector = this.getCssSelector(target);
    const href = target instanceof HTMLAnchorElement ? target.href : undefined;
    const ariaLabel = target.getAttribute('aria-label') || undefined;

    const capabilities = this.getClientCapabilities();

    const event: TrackedEvent = {
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      eventType: 'click',
      page: {
        path: window.location.pathname,
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
      },
      target: {
        tagName,
        id,
        className,
        innerText,
        selector,
        href,
        ariaLabel,
        coords: {
          x: Math.round(e.clientX),
          y: Math.round(e.clientY),
        },
      },
      ...capabilities,
      timestamp: new Date().toISOString(),
    };

    this.enqueue(event);
  }

  /**
   * Track navigated route / page view
   */
  public trackPageView(path: string, title?: string, referrer?: string): void {
    if (typeof window === 'undefined') return;

    const capabilities = this.getClientCapabilities();

    const event: TrackedEvent = {
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      eventType: 'page_view',
      page: {
        path: path || window.location.pathname,
        url: window.location.href,
        title: title || document.title,
        referrer: referrer || document.referrer,
      },
      ...capabilities,
      timestamp: new Date().toISOString(),
    };

    this.enqueue(event);
  }

  /**
   * Push event to queue and trigger batching logic
   */
  private enqueue(event: TrackedEvent): void {
    this.queue.push(event);

    if (this.queue.length >= this.MAX_BATCH_SIZE) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Flush queue to server
   */
  public flush(isUnload = false): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) return;

    const eventsToSend = [...this.queue];
    this.queue = [];

    const payload = JSON.stringify({
      events: eventsToSend,
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    const endpoint = `${this.apiUrl.replace(/\/+$/, '')}/tracking/events`;

    if (isUnload && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'larvo-client',
      },
      body: payload,
      keepalive: true,
      credentials: 'include',
    }).catch(() => {
      // Fail gracefully — tracking errors should never crash or alert the user
    });
  }
}

export const tracker = new TrackerService();
export default tracker;
