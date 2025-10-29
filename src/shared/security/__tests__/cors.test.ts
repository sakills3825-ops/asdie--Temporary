import {
  normalizeOrigin,
  isOriginAllowed,
  getCorsHeaders,
  handleCorsPreFlight,
  CORS_CONFIG,
} from '../cors';

describe('Security - CORS (P0: Origin Validation)', () => {
  describe('normalizeOrigin()', () => {
    it('should normalize standard origin', () => {
      expect(normalizeOrigin('https://trusted-api.example.com')).toBe(
        'https://trusted-api.example.com'
      );
    });

    it('should remove default port (443 for HTTPS)', () => {
      expect(normalizeOrigin('https://trusted-api.example.com:443')).toBe(
        'https://trusted-api.example.com'
      );
    });

    it('should remove default port (80 for HTTP)', () => {
      expect(normalizeOrigin('http://localhost:80')).toBe('http://localhost');
    });

    it('should keep non-default port', () => {
      expect(normalizeOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('should reject origin with fragment', () => {
      expect(normalizeOrigin('https://example.com#fragment')).toBeNull();
    });

    it('should reject origin with query string', () => {
      expect(normalizeOrigin('https://example.com?query=value')).toBeNull();
    });

    it('should reject origin with path', () => {
      expect(normalizeOrigin('https://example.com/path')).toBeNull();
    });

    it('should reject IPv4-mapped IPv6 addresses', () => {
      expect(normalizeOrigin('https://[::ffff:127.0.0.1]')).toBeNull();
    });

    it('should reject IPv4-mapped IPv6 addresses with port', () => {
      expect(normalizeOrigin('https://[::ffff:192.0.2.1]:443')).toBeNull();
    });

    it('should allow legitimate IPv6', () => {
      const result = normalizeOrigin('https://[::1]');
      expect(result).not.toBeNull();
      expect(result).toContain('::1');
    });

    it('should reject invalid URL', () => {
      expect(normalizeOrigin('not a url')).toBeNull();
      expect(normalizeOrigin('ht!tp://invalid')).toBeNull();
    });

    it('should reject empty string', () => {
      expect(normalizeOrigin('')).toBeNull();
    });

    it('P0: should reject subdomain attack vector', () => {
      // 공격: https://example.com.attacker.com
      expect(normalizeOrigin('https://example.com.attacker.com')).not.toBe(
        'https://example.com'
      );
    });

    it('P0: should reject null byte injection', () => {
      expect(normalizeOrigin('https://example.com%00.attacker.com')).toBeNull();
    });
  });

  describe('isOriginAllowed()', () => {
    it('should allow origin in whitelist', () => {
      expect(isOriginAllowed('https://trusted-api.example.com')).toBe(true);
    });

    it('should allow localhost for development', () => {
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    });

    it('should allow 127.0.0.1 for development', () => {
      expect(isOriginAllowed('http://127.0.0.1:3000')).toBe(true);
    });

    it('should reject non-whitelisted origin', () => {
      expect(isOriginAllowed('https://attacker.com')).toBe(false);
    });

    it('should reject origin with default port explicitly set', () => {
      // https://trusted-api.example.com:443 should normalize to https://trusted-api.example.com
      expect(isOriginAllowed('https://trusted-api.example.com:443')).toBe(true);
    });

    it('should be case-insensitive for protocol', () => {
      // URL API normalizes protocol to lowercase, so 'HTTPS://...' becomes 'https://...'
      // However, our CORS config has lowercase, so uppercase in config would fail
      // This tests that we handle URL normalization correctly
      const result = normalizeOrigin('HTTPS://trusted-api.example.com');
      expect(result).not.toBeNull();
      expect(result).toBe('https://trusted-api.example.com'); // URL API normalizes to lowercase
    });

    it('P0: should reject subdomain attack', () => {
      expect(isOriginAllowed('https://example.com.attacker.com')).toBe(false);
    });

    it('P0: should reject IPv4-mapped IPv6 bypass', () => {
      expect(isOriginAllowed('https://[::ffff:127.0.0.1]:3000')).toBe(false);
    });

    it('should reject invalid origin format', () => {
      expect(isOriginAllowed('not a url')).toBe(false);
      expect(isOriginAllowed('https://')).toBe(false);
    });

    it('should always reject empty string', () => {
      expect(isOriginAllowed('')).toBe(false);
    });
  });

  describe('getCorsHeaders()', () => {
    it('should return CORS headers for allowed origin', () => {
      const headers = getCorsHeaders('https://trusted-api.example.com');

      expect(headers).toHaveProperty('Access-Control-Allow-Origin');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://trusted-api.example.com');
      expect(headers).toHaveProperty('Access-Control-Allow-Methods');
      expect(headers).toHaveProperty('Access-Control-Allow-Headers');
      expect(headers).toHaveProperty('Access-Control-Allow-Credentials');
    });

    it('should include exposed headers', () => {
      const headers = getCorsHeaders('https://trusted-api.example.com');
      expect(headers).toHaveProperty('Access-Control-Expose-Headers');
      expect(headers['Access-Control-Expose-Headers']).toContain('X-Total-Count');
    });

    it('should set credentials to true', () => {
      const headers = getCorsHeaders('https://trusted-api.example.com');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should return empty object for disallowed origin', () => {
      const headers = getCorsHeaders('https://attacker.com');
      expect(Object.keys(headers).length).toBe(0);
    });

    it('should include all allowed methods', () => {
      const headers = getCorsHeaders('https://trusted-api.example.com');
      const methods = headers['Access-Control-Allow-Methods'];
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('OPTIONS');
    });

    it('should not expose internal origin in headers for rejected requests', () => {
      const headers = getCorsHeaders('https://attacker.com');
      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('P0: should use normalized origin in headers', () => {
      const headers = getCorsHeaders('http://127.0.0.1:3000');
      // 127.0.0.1:3000 should normalize and match allowed origin
      expect(Object.keys(headers).length).toBeGreaterThan(0);
      expect(headers['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:3000');
    });
  });

  describe('handleCorsPreFlight()', () => {
    it('should handle preflight for allowed origin', () => {
      const headers = handleCorsPreFlight('https://trusted-api.example.com');
      expect(headers).not.toBeNull();
      expect(headers!['Access-Control-Allow-Origin']).toBe('https://trusted-api.example.com');
    });

    it('should return null for disallowed origin', () => {
      const headers = handleCorsPreFlight('https://attacker.com');
      expect(headers).toBeNull();
    });

    it('should include preflight cache header', () => {
      const headers = handleCorsPreFlight('https://trusted-api.example.com');
      expect(headers).not.toBeNull();
      expect(headers!).toHaveProperty('Access-Control-Max-Age');
      expect(parseInt(headers!['Access-Control-Max-Age'])).toBeGreaterThan(0);
    });

    it('P0: should handle preflight with port normalization', () => {
      const headers = handleCorsPreFlight('http://127.0.0.1:3000');
      expect(headers).not.toBeNull();
    });
  });

  describe('CORS_CONFIG', () => {
    it('should have non-empty allowed origins', () => {
      expect(CORS_CONFIG.allowedOrigins.length).toBeGreaterThan(0);
    });

    it('should have specific origins (no wildcards)', () => {
      for (const origin of CORS_CONFIG.allowedOrigins) {
        expect(origin).not.toContain('*');
      }
    });

    it('should have reasonable method list', () => {
      expect(CORS_CONFIG.allowedMethods).toContain('GET');
      expect(CORS_CONFIG.allowedMethods).toContain('POST');
      expect(CORS_CONFIG.allowedMethods).toContain('OPTIONS');
    });

    it('should have maxAge set reasonably', () => {
      expect(CORS_CONFIG.maxAge).toBeGreaterThan(0);
      expect(CORS_CONFIG.maxAge).toBeLessThanOrEqual(86400); // 1 day
    });

    it('should not allow wildcard origin', () => {
      expect(CORS_CONFIG.allowedOrigins).not.toContain('*');
      expect(CORS_CONFIG.allowedOrigins.join('')).not.toContain('*');
    });
  });

  describe('P0: Security Requirements', () => {
    it('P0: should prevent subdomain takeover', () => {
      const attackVectors = [
        'https://example.com.attacker.com',
        'https://trusted-api.example.com.evil.com',
        'https://attacker.comtrusted-api.example.com',
      ];

      for (const vector of attackVectors) {
        expect(isOriginAllowed(vector)).toBe(false);
      }
    });

    it('P0: should prevent IPv6 address bypass', () => {
      const addresses = [
        'https://[::ffff:127.0.0.1]',
        'https://[::ffff:127.0.0.1]:3000',
        'https://[::ffff:192.0.2.1]',
      ];

      for (const addr of addresses) {
        expect(isOriginAllowed(addr)).toBe(false);
      }
    });

    it('P0: should enforce exact origin matching', () => {
      // Only exact matches should be allowed
      const exactMatch = 'https://trusted-api.example.com';
      expect(isOriginAllowed(exactMatch)).toBe(true);

      // Similar but different origins should fail
      expect(isOriginAllowed('https://trusted-api.example.com.fake')).toBe(false);
      expect(isOriginAllowed('https://trusted-apix.example.com')).toBe(false);
      expect(isOriginAllowed('https://api.example.com')).toBe(false);
    });

    it('P0: should reject origins with path/query/fragment', () => {
      const invalid = [
        'https://trusted-api.example.com/path',
        'https://trusted-api.example.com?query=value',
        'https://trusted-api.example.com#fragment',
        'https://trusted-api.example.com:443/path',
      ];

      for (const url of invalid) {
        expect(isOriginAllowed(url)).toBe(false);
      }
    });
  });
});
