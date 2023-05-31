import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * A module for utility functions.
 * @module Util
 */
export default {

  /**
   * Implementation of a conditional counter.
   * @param {Boolean} condition Either true or false. Note, the condition is not evaluated in the function. 
   * @param {Number} value The current count (of a certain feature).  
   * @returns {Number} Returns ``value + 1`` in case ``condition == true`` or ``value`` otherwise.
   */
  count: (condition, value) => {
    return (condition)
      ? value + 1
      : value;
  },

  /**
   * A function to encode boolean values as number (1 for ``true``, 0 for ``false``).
   * The encoding is later needed, when the data is fed into the classifier.
   * @param {Boolean} condition Either ``true`` or ``false``. Note, the condition is not evaluated in the function.
   * @returns {Number} Returns 1 in case ``true`` is passed, 0 otherwise.
   */
  zeroOrOne: (condition) =>
    (condition) ? 1 : 0,

  /**
   * A function to compute the ratio of two numbers.
   * **NOTE:** Returns 0 in case that the divisor is 0.
   * @param {Number} dividend The dividend of the ratio.
   * @param {Number} divisor The divisor of the ratio.
   * @returns {Number} The ratio between two numbers.
   */
  ratio: (dividend, divisor) => {
    return (divisor > 0) 
      ? dividend / divisor
      : 0;
  },

  /**
   * A wrapper function for ``Math.max()``.
   * @param {Number} x The first number.
   * @param {Number} y The second number.
   * @returns {Number} Returns the greater number.
   */
  max: (x, y) => {
    return Math.max(x, y);
  },

  /**
   * A function to extract a header field from the HTTP/S header of a request.
   * **NOTE:** The matching is case insensitive.
   * @param {Array} headers An array of HTTP/S header fields in the format 
   * ```json
   * { name: "key", value: "value" }
   * ```
   * @param {String} key An HTTP/S header key like ``Referer`` or ``Origin``.
   * @returns {Object} The requested HTTP/S header in the format: 
   * ```json
   * { name: "key", value: "value" }
   * ```
   * Returns ``undefined`` in case header with ``name === key`` is not present.
   */
  header(headers, key) {
    if (!headers) {
      headers = [];
    }
    return headers.find((h) => h.name.toLowerCase() === key.toLowerCase())
  },

  /**
   * A function to retrieve all query parameters of an HTTP/S request.
   * @param {Object} r An HTTP/S request retrieved from the ``webRequest`` interface. 
   * See {@link https://developer.chrome.com/docs/extensions/reference/webRequest/#event-onBeforeRequest|webRequest.onBeforeRequest()}
   * for more details.
   * @returns {Array} Returns an array of all query parameters in the format:
   * ```json
   * [ [param_1, value_1], [param_2, value_2], ..., [param_n, value_n] ]
   * ```
   * Returns an empty array in case no query parameters are present.
   */
  params(r) {
    let u = new URL(this.target(r));
    return (u.searchParams)
      ? [...u.searchParams.entries()]
      : []
  },

  /**
   * A function to retrieve all cookie fields of an HTTP/S request.
   * @param {Object} r An HTTP/S request retrieved from the ``webRequest`` interface. 
   * See {@link https://developer.chrome.com/docs/extensions/reference/webRequest/#event-onBeforeRequest|webRequest.onBeforeRequest()}
   * for more details.
   * @returns Returns an array of all cookie fields in the format:
   * ```json
   * [ [field_1, value_1], [field_2, value_2], ..., [field_n, value_n] ]
   * ```
   * Returns an empty array in case no cookie is present.
   */
  cookie(r) {
    let c = this.header(r.requestHeaders, 'cookie');
    return (c) 
      ? c.value.split(";").map((el) => el.trim().split("="))
      : [];
  },

  /**
   * A function to extract the target URL of an HTTP/S request.
   * The function will extract the ``url`` property of the request
   * and falls back to the ``url`` property of the response in case
   * no ``url`` property is present in the request.
   * @param {Object} r An HTTP/S request retrieved from the ``webRequest`` interface. 
   * See {@link https://developer.chrome.com/docs/extensions/reference/webRequest/#event-onBeforeRequest|webRequest.onBeforeRequest()}
   * for more details.
   * @returns {String} Returns the full target URL as string. Returns ``undefined`` 
   * in case the ``url`` property is neither present in the request nor the response.
   */
  target(r) {
    if (r.url) {
      return r.url;
    } else if (r.response) {
      if (r.response.url) {
        return r.response.url;
      }
    }    
  },
  
  /**
   * A function to extract the source of an HTTP/S request.
   * The function will use the ``initiator`` property of the request.
   * If this property is absent, the function tries
   * to extract the source from the ``referer`` or ``origin`` HTTP/S header.
   * @param {Object} r An HTTP/S request retrieved from the ``webRequest`` interface. 
   * See {@link https://developer.chrome.com/docs/extensions/reference/webRequest/#event-onBeforeRequest|webRequest.onBeforeRequest()}
   * for more details.
   * @returns {String} Returns the full source URL as string. Returns ``undefined``
   * in case no source could be extracted.
   */
  source(r) {
    if (r.initiator) {
      return r.initiator;
    } else if (r.requestHeaders) {
      let referer = this.header(r.requestHeaders, 'referer');
      if (referer) {
        return referer.value;
      } else {
        let origin = this.header(r.requestHeaders, 'origin');
        if (origin) {
          return origin.value;
        }
      }
    }    
  },

  /**
   * A function to check whether an absolute or relative path exists.
   * @param {String} dir A given path as string.
   * @returns {String} Returns the path in case it exists. Returns ``null`` otherwise.
   */
  path(dir) {
    return (fs.existsSync(dir)) 
      ? dir
      : (fs.existsSync(__dirname + '/' + dir))
        ? rel // TODO: not defined
        : null;    
  },

  /**
   * A function to check whether a path is a directory.
   * This is a wrapper function for ``fs.lstatSync(path).isDirectory()``.
   * @param {String} path  A given path as string.
   * @returns {Boolean} 
   */
  isDir(path) {
    return fs
      .lstatSync(path)
      .isDirectory();
  },

  /**
   * A function to read the contents of a directory and to
   * extract all files with the file extension ``*.json``.
   * @param {String} path A given path as string.
   * @returns {Array} Returns all JSON files contained in ``path``.
   */
  batches(path) {
    return fs
      .readdirSync(path)
      .filter((file) => file.endsWith('.json'));
  },

};