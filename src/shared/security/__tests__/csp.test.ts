import {
  generateCspHeader,
  generateCspMetaTag,
  isValidCspViolationReport,
  CSP_POLICY,
} from '../csp';

describe('Security - CSP (P0: Content Security Policy)', () => {
  describe('CSP_POLICY', () => {
    it('should not have unsafe-inline in script-src', () => {
      expect(CSP_POLICY['script-src']).not.toContain("'unsafe-inline'");
    });

    it('should not have unsafe-eval in script-src', () => {
      expect(CSP_POLICY['script-src']).not.toContain("'unsafe-eval'");
    });

    it('should not have unsafe-inline in style-src', () => {
      expect(CSP_POLICY['style-src']).not.toContain("'unsafe-inline'");
    });

    it('should allow self origin for scripts', () => {
      expect(CSP_POLICY['script-src']).toContain("'self'");
    });

    it('should allow self for styles', () => {
      expect(CSP_POLICY['style-src']).toContain("'self'");
    });

    it('should disable plugins (object-src none)', () => {
      expect(CSP_POLICY['object-src']).toContain("'none'");
    });

    it('should prevent frame embedding', () => {
      expect(CSP_POLICY['frame-ancestors']).toContain("'none'");
    });

    it('should disable child frames', () => {
      expect(CSP_POLICY['child-src']).toContain("'none'");
    });

    it('should restrict form submission', () => {
      expect(CSP_POLICY['form-action']).toContain("'self'");
    });

    it('should upgrade insecure requests', () => {
      expect(CSP_POLICY['upgrade-insecure-requests']).toBeDefined();
    });

    it('P0: should have secure default-src', () => {
      expect(CSP_POLICY['default-src']).toEqual(["'self'"]);
    });

    it('P0: should restrict connect to HTTPS', () => {
      expect(CSP_POLICY['connect-src']).toContain('https:');
      // HTTP should only be for localhost
      const connectSrc = CSP_POLICY['connect-src'];
      expect(connectSrc).toContain('http://localhost:*');
    });
  });

  describe('generateCspHeader()', () => {
    it('should generate valid CSP header string', () => {
      const header = generateCspHeader();
      expect(typeof header).toBe('string');
      expect(header.length).toBeGreaterThan(0);
    });

    it('should include default-src directive', () => {
      const header = generateCspHeader();
      expect(header).toContain("default-src 'self'");
    });

    it('should include script-src directive', () => {
      const header = generateCspHeader();
      expect(header).toContain('script-src');
      expect(header).not.toContain("script-src 'unsafe-inline'");
      expect(header).not.toContain("script-src 'unsafe-eval'");
    });

    it('should include style-src directive', () => {
      const header = generateCspHeader();
      expect(header).toContain('style-src');
      expect(header).not.toContain("style-src 'unsafe-inline'");
    });

    it('should have directives separated by semicolons', () => {
      const header = generateCspHeader();
      const directives = header.split(';').map((d) => d.trim());
      expect(directives.length).toBeGreaterThan(5);
      expect(directives.every((d) => d.length > 0)).toBe(true);
    });

    it('should not have trailing semicolons', () => {
      const header = generateCspHeader();
      expect(header.endsWith(';')).toBe(false);
    });

    it('P0: should not contain unsafe directives', () => {
      const header = generateCspHeader();
      expect(header).not.toContain("'unsafe-inline'");
      expect(header).not.toContain("'unsafe-eval'");
    });

    it('should be consistent across multiple calls', () => {
      const header1 = generateCspHeader();
      const header2 = generateCspHeader();
      expect(header1).toBe(header2);
    });

    it('should format directives properly', () => {
      const header = generateCspHeader();
      // Each directive should have at least one space after it
      const parts = header.split(';');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length > 0) {
          // Should be in format "directive value value ..."
          expect(trimmed).toMatch(/^[a-z-]+(\s|$)/);
        }
      }
    });
  });

  describe('generateCspMetaTag()', () => {
    it('should generate valid HTML meta tag', () => {
      const tag = generateCspMetaTag();
      // Check basic structure
      expect(tag).toContain('<meta http-equiv="Content-Security-Policy"');
      expect(tag).toContain('content="');
      expect(tag).toMatch(/\/\s*>$/); // self-closing tag
    });

    it('should include CSP header in content attribute', () => {
      const tag = generateCspMetaTag();
      // Check that meta tag contains the CSP policy (may be HTML-escaped)
      expect(tag).toContain('default-src');
      expect(tag).toContain('self');
    });

    it('should escape HTML special characters', () => {
      const tag = generateCspMetaTag();
      // Content attribute should use &quot; for quotes
      expect(tag).toContain('content="');
      // Should not have unescaped quotes inside
      const contentPart = tag.match(/content="([^"]*)"/)![1];
      expect(contentPart).not.toContain('"'); // unescaped quotes
    });

    it('should be consistent across calls', () => {
      const tag1 = generateCspMetaTag();
      const tag2 = generateCspMetaTag();
      expect(tag1).toBe(tag2);
    });

    it('P0: should contain strong CSP policy', () => {
      const tag = generateCspMetaTag();
      // Check escaped form: frame-ancestors &#x27;none&#x27;
      expect(tag).toContain('frame-ancestors');
      expect(tag).toContain('none');
      expect(tag).toContain('object-src');
    });
  });

  describe('isValidCspViolationReport()', () => {
    it('should accept valid CSP violation report', () => {
      const report = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'enforce' as const,
        },
      };
      expect(isValidCspViolationReport(report)).toBe(true);
    });

    it('should accept report with blocked-uri', () => {
      const report = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'enforce' as const,
          'blocked-uri': 'https://attacker.com/malicious.js',
        },
      };
      expect(isValidCspViolationReport(report)).toBe(true);
    });

    it('should accept report disposition report', () => {
      const report = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'report' as const,
        },
      };
      expect(isValidCspViolationReport(report)).toBe(true);
    });

    it('should reject report without csp-report', () => {
      expect(isValidCspViolationReport({ invalid: true })).toBe(false);
    });

    it('should reject report with non-object csp-report', () => {
      expect(
        isValidCspViolationReport({
          'csp-report': 'not an object',
        })
      ).toBe(false);
    });

    it('should reject report missing document-uri', () => {
      const report = {
        'csp-report': {
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'enforce',
        },
      };
      expect(isValidCspViolationReport(report)).toBe(false);
    });

    it('should reject report missing violated-directive', () => {
      const report = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'enforce',
        },
      };
      expect(isValidCspViolationReport(report)).toBe(false);
    });

    it('should reject report missing disposition', () => {
      const report = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
        },
      };
      expect(isValidCspViolationReport(report)).toBe(false);
    });

    it('should reject null', () => {
      expect(isValidCspViolationReport(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidCspViolationReport(undefined)).toBe(false);
    });

    it('should reject non-object values', () => {
      expect(isValidCspViolationReport('string')).toBe(false);
      expect(isValidCspViolationReport(123)).toBe(false);
      expect(isValidCspViolationReport([])).toBe(false);
    });

    it('should accept report with line/column numbers', () => {
      const report = {
        'csp-report': {
          'document-uri': 'https://example.com',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'",
          'disposition': 'enforce' as const,
          'source-file': 'https://example.com/main.js',
          'line-number': 10,
          'column-number': 5,
        },
      };
      expect(isValidCspViolationReport(report)).toBe(true);
    });

    it('P0: should handle real-world report structure', () => {
      const report = {
        'csp-report': {
          'document-uri': 'https://aside.dev/',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
          'original-policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'",
          'blocked-uri': 'inline',
          'disposition': 'enforce',
          'status-code': 200,
        },
      };
      expect(isValidCspViolationReport(report)).toBe(true);
    });
  });

  describe('P0: Security Requirements', () => {
    it('P0: should not allow inline scripts', () => {
      const header = generateCspHeader();
      // Check that unsafe-inline is not in script-src
      const scriptSrcMatch = header.match(/script-src ([^;]+)/);
      expect(scriptSrcMatch).not.toBeNull();
      expect(scriptSrcMatch![1]).not.toContain("'unsafe-inline'");
    });

    it('P0: should not allow eval', () => {
      const header = generateCspHeader();
      const scriptSrcMatch = header.match(/script-src ([^;]+)/);
      expect(scriptSrcMatch).not.toBeNull();
      expect(scriptSrcMatch![1]).not.toContain("'unsafe-eval'");
    });

    it('P0: should block plugins', () => {
      const header = generateCspHeader();
      expect(header).toMatch(/object-src\s+'none'/);
    });

    it('P0: should prevent clickjacking', () => {
      const header = generateCspHeader();
      expect(header).toMatch(/frame-ancestors\s+'none'/);
    });

    it('P0: should enforce HTTPS', () => {
      const header = generateCspHeader();
      expect(header).toContain('upgrade-insecure-requests');
    });

    it('P0: should restrict form submission', () => {
      const header = generateCspHeader();
      expect(header).toMatch(/form-action\s+'self'/);
    });

    it('P0: should not allow wildcard sources', () => {
      const header = generateCspHeader();
      // Only 'none' and 'self' should be in the header, no wildcards
      expect(header).not.toMatch(/\s\*[;\s]/);
    });
  });
});
