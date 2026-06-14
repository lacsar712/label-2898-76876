import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uiJsPath = path.resolve(__dirname, '..', 'ui.js');
const uiJsContent = fs.readFileSync(uiJsPath, 'utf-8');

describe('UI Captcha Functions', () => {
  let container;

  beforeAll(() => {
    const script = document.createElement('script');
    script.textContent = uiJsContent;
    document.head.appendChild(script);
  });

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'captcha-container';
    document.body.appendChild(container);
  });

  describe('initCaptcha', () => {
    it('should set captcha text with correct format "a + b = ?"', () => {
      UI.initCaptcha('captcha-container');

      const text = container.innerText;
      expect(text).toMatch(/^\d+ \+ \d+ = \?$/);
    });

    it('should store correct result in dataset.result', () => {
      UI.initCaptcha('captcha-container');

      const text = container.innerText;
      const match = text.match(/^(\d+) \+ (\d+) = \?$/);
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      const expectedResult = a + b;

      expect(parseInt(container.dataset.result, 10)).toBe(expectedResult);
    });

    it('should generate numbers between 0 and 9 (inclusive)', () => {
      for (let i = 0; i < 100; i++) {
        UI.initCaptcha('captcha-container');
        const text = container.innerText;
        const match = text.match(/^(\d+) \+ (\d+) = \?$/);
        const a = parseInt(match[1], 10);
        const b = parseInt(match[2], 10);

        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(9);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(9);
      }
    });

    it('should update result when called multiple times (refresh)', () => {
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = () => {
        callCount++;
        if (callCount <= 2) return 0.1;
        if (callCount <= 4) return 0.9;
        return 0.5;
      };

      try {
        UI.initCaptcha('captcha-container');
        const firstResult = container.dataset.result;
        const firstText = container.innerText;

        callCount = 0;
        UI.initCaptcha('captcha-container');
        const secondResult = container.dataset.result;
        const secondText = container.innerText;

        expect(firstResult).not.toBe(secondResult);
        expect(firstText).not.toBe(secondText);
      } finally {
        Math.random = originalRandom;
      }
    });

    it('should handle non-existent container gracefully', () => {
      expect(() => {
        UI.initCaptcha('non-existent-container');
      }).not.toThrow();
    });
  });

  describe('checkCaptcha', () => {
    beforeEach(() => {
      UI.initCaptcha('captcha-container');
    });

    it('should return true when input matches the result (as string)', () => {
      const result = container.dataset.result;
      expect(UI.checkCaptcha('captcha-container', result)).toBe(true);
    });

    it('should return true when input matches the result (as number)', () => {
      const result = parseInt(container.dataset.result, 10);
      expect(UI.checkCaptcha('captcha-container', result)).toBe(true);
    });

    it('should return false when input is wrong', () => {
      const wrongValue = parseInt(container.dataset.result, 10) + 1;
      expect(UI.checkCaptcha('captcha-container', wrongValue)).toBe(false);
    });

    it('should return false for empty string input', () => {
      expect(UI.checkCaptcha('captcha-container', '')).toBe(false);
    });

    it('should return false for null input', () => {
      expect(UI.checkCaptcha('captcha-container', null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(UI.checkCaptcha('captcha-container', undefined)).toBe(false);
    });

    it('should return false for non-numeric string input', () => {
      expect(UI.checkCaptcha('captcha-container', 'abc')).toBe(false);
    });

    it('should return false for negative number input when result is non-negative', () => {
      expect(UI.checkCaptcha('captcha-container', -1)).toBe(false);
    });

    it('should handle non-existent container gracefully', () => {
      expect(() => {
        UI.checkCaptcha('non-existent-container', '5');
      }).toThrow();
    });
  });

  describe('Integration: initCaptcha + checkCaptcha', () => {
    it('should correctly verify a freshly initialized captcha', () => {
      UI.initCaptcha('captcha-container');
      const answer = parseInt(container.dataset.result, 10);

      expect(UI.checkCaptcha('captcha-container', answer)).toBe(true);
      expect(UI.checkCaptcha('captcha-container', answer + 100)).toBe(false);
    });

    it('should correctly verify after refresh (init again)', () => {
      const originalRandom = Math.random;

      let callCount = 0;
      Math.random = () => {
        callCount++;
        if (callCount <= 2) return 0.1;
        return 0.9;
      };

      try {
        UI.initCaptcha('captcha-container');
        const firstAnswer = parseInt(container.dataset.result, 10);

        callCount = 0;
        UI.initCaptcha('captcha-container');
        const secondAnswer = parseInt(container.dataset.result, 10);

        expect(UI.checkCaptcha('captcha-container', secondAnswer)).toBe(true);
        expect(UI.checkCaptcha('captcha-container', firstAnswer)).toBe(false);
      } finally {
        Math.random = originalRandom;
      }
    });
  });
});
