// tests/clasp.test.js
// Clasp クラスのユニットテスト

import { jest, describe, test, beforeEach, afterEach, expect } from '@jest/globals';
import Clasp from '../clasp/Clasp.js';

// Chrome Storage API 相当のモック
// 実際の chrome.storage.local/sync の get, set 機能をエミュレート
const createMockStorage = () => {
  const store = {};
  return {
    get: jest.fn(async (key) => {
      if (Array.isArray(key)) {
        // 複数キー取得
        const result = {};
        for (const k of key) {
          result[k] = store[k];
        }
        return result;
      } else if (typeof key === 'string') {
        // 単一キー取得
        return { [key]: store[key] };
      } else {
        // オブジェクト形式 (例: chrome.storage.local.get({key1: 'default'}))
        const result = {};
        for (const k in key) {
          result[k] = store[k] !== undefined ? store[k] : key[k]; // デフォルト値サポート
        }
        return result;
      }
    }),
    set: jest.fn(async (items) => {
      for (const key in items) {
        store[key] = items[key];
      }
    }),
  };
};

describe('Clasp', () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    // Jest の fetch モックを初期化
    global.fetch = jest.fn();
    // fetch の成功レスポンスをモック
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(''),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with storage', () => {
      const clasp = new Clasp(mockStorage);
      expect(clasp.storage).toBe(mockStorage);
      expect(clasp.credentials).toBeNull();
    });

    test('should throw error if no storage provided', () => {
      expect(() => {
        new Clasp();
      }).toThrow('Storage area is required for Clasp class.');
    });
  });

  describe('saveCredentials', () => {
    test('should save credentials to storage and update instance variable', async () => {
      const clasp = new Clasp(mockStorage);
      const credentials = { accessToken: 'test_token', expiryDate: Date.now() + 3600000 };

      await clasp.saveCredentials(credentials);

      expect(mockStorage.set).toHaveBeenCalledWith({ clasprc: credentials });
      expect(clasp.credentials).toEqual(credentials);
    });
  });

  describe('loadCredentials', () => {
    test('should load credentials from storage', async () => {
      const credentials = { accessToken: 'test_token', expiryDate: Date.now() + 3600000 };
      mockStorage.get.mockResolvedValue({ clasprc: credentials });

      const clasp = new Clasp(mockStorage);
      const result = await clasp.loadCredentials();

      expect(mockStorage.get).toHaveBeenCalledWith('clasprc');
      expect(result).toEqual(credentials);
      expect(clasp.credentials).toEqual(credentials);
    });

    test('should return null if no credentials found', async () => {
      mockStorage.get.mockResolvedValue({});

      const clasp = new Clasp(mockStorage);
      const result = await clasp.loadCredentials();

      expect(result).toBeNull();
      expect(clasp.credentials).toBeNull();
    });
  });

  describe('saveProjectSettings', () => {
    test('should save project settings to storage', async () => {
      const clasp = new Clasp(mockStorage);
      const settings = { scriptId: '12345', rootDir: 'src', projectId: 'project123' };

      await clasp.saveProjectSettings(settings);

      expect(mockStorage.set).toHaveBeenCalledWith({ claspSettings: settings });
    });
  });

  describe('loadProjectSettings', () => {
    test('should load project settings from storage', async () => {
      const settings = { scriptId: '12345', rootDir: 'src', projectId: 'project123' };
      mockStorage.get.mockResolvedValue({ claspSettings: settings });

      const clasp = new Clasp(mockStorage);
      const result = await clasp.loadProjectSettings();

      expect(mockStorage.get).toHaveBeenCalledWith('claspSettings');
      expect(result).toEqual(settings);
    });

    test('should return null if no project settings found', async () => {
      mockStorage.get.mockResolvedValue({});

      const clasp = new Clasp(mockStorage);
      const result = await clasp.loadProjectSettings();

      expect(result).toBeNull();
    });
  });

  describe('callGASAPI', () => {
    test('should throw error if no credentials', async () => {
      const clasp = new Clasp(mockStorage);

      await expect(clasp.callGASAPI('12345', 'GET')).rejects.toThrow('Authentication required. Please log in using clasp.');
    });

    test('should throw error if token expired', async () => {
      const clasp = new Clasp(mockStorage);
      const expiredCredentials = { accessToken: 'old_token', expiryDate: Date.now() - 1000 };
      await clasp.saveCredentials(expiredCredentials);

      await expect(clasp.callGASAPI('12345', 'GET')).rejects.toThrow('Access token has expired. Please re-authenticate.');
    });

    test('should call fetch with correct parameters and return JSON', async () => {
      const credentials = { accessToken: 'valid_token', expiryDate: Date.now() + 3600000 };
      const responseBody = { files: [] };
      const mockFetchResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(responseBody),
        text: jest.fn().mockResolvedValue(JSON.stringify(responseBody)),
      };

      global.fetch.mockResolvedValue(mockFetchResponse);

      const clasp = new Clasp(mockStorage);
      await clasp.saveCredentials(credentials);

      const result = await clasp.callGASAPI('12345', 'GET', ':getContent');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://script.googleapis.com/v1/scripts/12345:getContent',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid_token',
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual(responseBody);
    });

    test('should throw error if fetch response is not ok', async () => {
      const credentials = { accessToken: 'valid_token', expiryDate: Date.now() + 3600000 };
      const mockFetchResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('Not Found'),
      };

      global.fetch.mockResolvedValue(mockFetchResponse);

      const clasp = new Clasp(mockStorage);
      await clasp.saveCredentials(credentials);

      await expect(clasp.callGASAPI('12345', 'GET', ':getContent')).rejects.toThrow('API request failed: 404 Not Found. Details: Not Found');
    });
  });

  describe('pullProject', () => {
    test('should call API and return mapped files', async () => {
      const credentials = { accessToken: 'valid_token', expiryDate: Date.now() + 3600000 };
      const apiResponse = {
        files: [
          { name: 'Code', type: 'server_js', source: 'function test() {}' },
          { name: 'Index', type: 'html', source: '<html>...</html>' },
        ],
      };
      const expectedFiles = [
        { name: 'Code', type: 'server_js', source: 'function test() {}' },
        { name: 'Index', type: 'html', source: '<html>...</html>' },
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(apiResponse),
        text: jest.fn().mockResolvedValue(''),
      });

      const clasp = new Clasp(mockStorage);
      await clasp.saveCredentials(credentials);

      const result = await clasp.pullProject('12345');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://script.googleapis.com/v1/scripts/12345:getContent',
        expect.any(Object)
      );
      expect(result).toEqual(expectedFiles);
    });

    test('should throw error if no scriptId provided', async () => {
      const clasp = new Clasp(mockStorage);

      await expect(clasp.pullProject()).rejects.toThrow('Script ID is required for pullProject.');
    });
  });

  describe('pushProject', () => {
    test('should call API with correct request body', async () => {
      const credentials = { accessToken: 'valid_token', expiryDate: Date.now() + 3600000 };
      const files = [
        { name: 'Code', type: 'server_js', source: 'function test() {}' },
        { name: 'Index', type: 'html', source: '<html>...</html>' },
      ];
      const requestBody = {
        files: [
          { name: 'Code', type: 'server_js', source: 'function test() {}' },
          { name: 'Index', type: 'html', source: '<html>...</html>' },
        ],
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
        text: jest.fn().mockResolvedValue(''),
      });

      const clasp = new Clasp(mockStorage);
      await clasp.saveCredentials(credentials);

      await clasp.pushProject('12345', files);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://script.googleapis.com/v1/scripts/12345:updateContent',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(requestBody),
        })
      );
    });

    test('should throw error if no scriptId or files provided', async () => {
      const clasp = new Clasp(mockStorage);

      await expect(clasp.pushProject()).rejects.toThrow('Script ID is required for pushProject.');
      await expect(clasp.pushProject('12345')).rejects.toThrow('Files array is required for pushProject.');
    });
  });
});