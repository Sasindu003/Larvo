import { Request } from 'express';

export interface ParsedClientInfo {
  browser: {
    name: string;
    version: string;
  };
  os: {
    name: string;
    version: string;
  };
  device: {
    type: string;
    vendor?: string;
    model?: string;
  };
  userAgent: string;
}

export interface ParsedGeoLocation {
  country: string;
  region: string;
  city: string;
  timezone: string;
}

/**
 * Extract clean real client IP from request headers or socket
 */
export function extractClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cfIp.trim();
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  const remote = req.socket?.remoteAddress || req.ip || '127.0.0.1';
  if (remote === '::1' || remote === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }
  return remote;
}

/**
 * Extract geo location info from proxy/edge headers and client payload
 */
export function extractGeoLocation(req: Request, clientTimezone?: string): ParsedGeoLocation {
  const country =
    (req.headers['x-vercel-ip-country'] as string) ||
    (req.headers['cf-ipcountry'] as string) ||
    'Unknown';

  const region = (req.headers['x-vercel-ip-country-region'] as string) || '';
  const city = (req.headers['x-vercel-ip-city'] as string) || '';

  return {
    country: country === 'Unknown' && extractClientIp(req) === '127.0.0.1' ? 'Localhost' : country,
    region,
    city,
    timezone: clientTimezone || 'UTC',
  };
}

/**
 * Parse raw User-Agent string to structured browser, OS, and device info
 */
export function parseUserAgent(uaString: string = ''): ParsedClientInfo {
  const ua = uaString || '';

  // 1. Detect OS
  let osName = 'Unknown';
  let osVersion = '';

  if (/Windows NT 10\.0/i.test(ua)) {
    osName = 'Windows';
    osVersion = '10/11';
  } else if (/Windows NT 6\.3/i.test(ua)) {
    osName = 'Windows';
    osVersion = '8.1';
  } else if (/Windows NT 6\.1/i.test(ua)) {
    osName = 'Windows';
    osVersion = '7';
  } else if (/Windows/i.test(ua)) {
    osName = 'Windows';
  } else if (/Android (\d+(\.\d+)?)/i.test(ua)) {
    const match = ua.match(/Android (\d+(\.\d+)?)/i);
    osName = 'Android';
    osVersion = match ? match[1] : '';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    osName = 'iOS';
    const match = ua.match(/OS (\d+[_.]\d+)/i);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (/Mac OS X (\d+[_.]\d+)/i.test(ua)) {
    osName = 'macOS';
    const match = ua.match(/Mac OS X (\d+[_.]\d+)/i);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  } else if (/CrOS/i.test(ua)) {
    osName = 'ChromeOS';
  } else if (/Linux/i.test(ua)) {
    osName = 'Linux';
  }

  // 2. Detect Browser
  let browserName = 'Unknown';
  let browserVersion = '';

  if (/Edg\/(\d+(\.\d+)?)/i.test(ua)) {
    browserName = 'Edge';
    const m = ua.match(/Edg\/(\d+(\.\d+)?)/i);
    browserVersion = m ? m[1] : '';
  } else if (/OPR\/(\d+(\.\d+)?)/i.test(ua) || /Opera/i.test(ua)) {
    browserName = 'Opera';
    const m = ua.match(/OPR\/(\d+(\.\d+)?)/i);
    browserVersion = m ? m[1] : '';
  } else if (/SamsungBrowser\/(\d+(\.\d+)?)/i.test(ua)) {
    browserName = 'Samsung Internet';
    const m = ua.match(/SamsungBrowser\/(\d+(\.\d+)?)/i);
    browserVersion = m ? m[1] : '';
  } else if (/Chrome\/(\d+(\.\d+)?)/i.test(ua) && !/Chromium/i.test(ua)) {
    browserName = 'Chrome';
    const m = ua.match(/Chrome\/(\d+(\.\d+)?)/i);
    browserVersion = m ? m[1] : '';
  } else if (/Version\/(\d+(\.\d+)?).*Safari/i.test(ua)) {
    browserName = 'Safari';
    const m = ua.match(/Version\/(\d+(\.\d+)?)/i);
    browserVersion = m ? m[1] : '';
  } else if (/Firefox\/(\d+(\.\d+)?)/i.test(ua)) {
    browserName = 'Firefox';
    const m = ua.match(/Firefox\/(\d+(\.\d+)?)/i);
    browserVersion = m ? m[1] : '';
  }

  // 3. Detect Device Form Factor
  let deviceType = 'desktop';
  let vendor = '';
  let model = '';

  if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/bot|crawler|spider|googlebot|bingbot/i.test(ua)) {
    deviceType = 'bot';
  }

  if (/iPhone/i.test(ua)) {
    vendor = 'Apple';
    model = 'iPhone';
  } else if (/iPad/i.test(ua)) {
    vendor = 'Apple';
    model = 'iPad';
  } else if (/Macintosh/i.test(ua)) {
    vendor = 'Apple';
    model = 'Mac';
  } else if (/Samsung/i.test(ua)) {
    vendor = 'Samsung';
  }

  return {
    browser: {
      name: browserName,
      version: browserVersion,
    },
    os: {
      name: osName,
      version: osVersion,
    },
    device: {
      type: deviceType,
      vendor: vendor || undefined,
      model: model || undefined,
    },
    userAgent: ua,
  };
}
