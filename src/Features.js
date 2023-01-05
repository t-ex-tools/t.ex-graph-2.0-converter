import fs from 'fs';
import Util from "./Util.js";
import pkg from 'tldjs';
const { getDomain } = pkg;

/**
 * @module Features
 * @desc A module to implement functions to extract features from the
 *       stream of HTTP/S requests and responses.
 *       This module returns an object containing all features that are
 *       extracted in {@link Wdg.addEdge|``Wdg.addEdge()``}.
 *       A feature itself is an object consisting of three properties:
 *       ``extract``, ``accumulate`` (optional), and ``set``. 
 *       **NOTE:** The key of this object will be used as the name 
 *       of the feature.
 *       Its properties have to implement functions, which are
 *       called at different stages in the graph generation process.
 *       See below an example for a feature object:
 * 
 *       tracking: {
 *        'extract': (r, acc) => {
 *          let isTracking = r.labels
 *            .reduce((acc, val) =>
 *              acc || val.isLabeled,
 *              false
 *            );
 *
 *          return Util.count(isTracking, acc);
 *        },
 *        'set': (feature, attrs) => {
 *          return Util.ratio(attrs[feature], attrs.count);
 *        }
 *      }
 * 
 */      
 
/**
 * @name extract
 * @desc ``extract()``is called for each HTTP/S request in {@link Wdg.addEdge|``Wdg.addEdge()``}.
 * @function
 * @param {Object} r An HTTP/S request retrieved from the ``webRequest`` interface. 
 * See {@link https://developer.chrome.com/docs/extensions/reference/webRequest/#event-onBeforeRequest|webRequest.onBeforeRequest()}
 * for more details.
 * @param {Number} acc In case the edge is created 0 will be passed as ``acc``.
 * In case the edge already exists, the current value of the edge attribute
 * is passed as ``acc`` (i.e., the result of the previous ``extract()`` call).
 * @returns {Number} The new value of the edge attribute.
 */

/**
 * @name accumulate
 * @desc ``accumulate()`` is called for each node, when reducing the 
 * edge attributes of each in-neighbor in {@link Wdg.attributes|Wdg.attributes()}.
 * The property is optional. In case it is ``undefined``, the sum will be computed
 * for each edge attribute.
 * @function
 * @param {Number} x The accumulator value of the reduce operation.
 * @param {Number} y The value of a specific edge attribute of an edge.
 * @returns {Number} The new value of the edge attribute.
 */

/**
 * @name set
 * @desc ``set()`` is called for each node, when finally computing the node attributes 
 * based on the accumulated edge attributes.
 * @function
 * @param {String} feature The name of the feature.
 * @param {Object} attrs The accumulated edge attributes including the indegree of the node.
 * @returns {Number} The final value for ``feature``.
 */

/**
 * @constant
 * @type {Array}
 * @default [ "xmlhttprequest", "image", "font", "script", "stylesheet", "ping", "sub_frame", "other", "main_frame", "csp_report", "object", "media" ]
 * @desc Array of all possible request types. 
 *       See {@link https://developer.chrome.com/docs/extensions/reference/webRequest/#type-ResourceType}
 *       for more details.
 */
const requestTypes = JSON.parse(fs.readFileSync('src/assets/request.types.json'));

/**
 * @constant
 * @type {Array}
 * @default [ "GET", "POST", "OPTIONS", "HEAD", "PUT", "DELETE", "SEARCH", "PATCH" ]
 * @desc Array of all possible request methods. 
 *       See {@link https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods}
 *       for more details.
 */
const requestMethods = JSON.parse(fs.readFileSync('src/assets/request.methods.json'));

/**
 * @constant
 * @type {Function}
 * @param {String} extractedValue 
 * @param {String} seekedValue 
 * @returns {Boolean}
 * @desc A function that checks strict equality of two strings. 
 *       Instantly returns false in case one or both string are undefined, null, or empty.
 */
const stringComparison = (extractedValue, seekedValue) => {
  if (extractedValue && seekedValue) {
    return extractedValue.toLowerCase() === seekedValue.toLowerCase();
  } else {
    return false;
  }
};

/**
 * @constant
 * @type {Object}
 * @desc A helper object to treat the generation process of 
 *       request types and methods differently as the extraction differs.
 */
const values = {

  type: {
    source: requestTypes,
    extract: (r) => r.type,
    condition: stringComparison,
    divisor: 'count'
  },

  method: {
    source: requestMethods,
    extract: (r) => r.method,
    condition: stringComparison,
    divisor: 'count'
  }

};

/**
 * A function to generate feature objects.
 * Used to generate the feature objects for each
 * request type and method.
 * @param {Object} value A child property of {@link Features#values}
 * @returns Object
 */
let generate = (value) => {
  return value
    .source
    .reduce((acc, val) => {
      acc[val] = {
        'extract': (r, accu) => {
          let feature = value.extract(r);
          return Util.count(value.condition(feature, val), accu);
        },
        'set': (feature, attrs) => {
          return Util.ratio(attrs[feature], attrs[value.divisor]);
        }
      };

      return acc;
    }, {})
};

export default (() => {

  return {

    /**
     * @name {requestType}
     * @desc For each {@link module:Features.requestTypes|``Features.requestTypes``}
     * we compute the total number of requests with that specific type and divide 
     * it by the total number of requests to that node.
     */

    /**
     * @name {requestMethod}
     * @desc For each {@link module:Features.requestMethods|``Features.requestMethods``}
     * we compute the total number of requests with that specific request method 
     * and divide it by the total number of requests to that node.
     */

    ...Object
      .keys(values)
      .reduce((acc, val) => {
        return {
          ...acc,
          ...generate(values[val])
        }
      }, {}),

    /**
     * HTTP/S request count
     */
    count: {
      'extract': (r, acc) => {
        return acc + 1;
      },
      'set': (feature, attrs) => {
        return attrs.count;
      }
    },

    /**
     * Tracking requests count
     * **NOTE:** 
     * HTTP/S requests are matched against filter lists (e.g., EasyList & EasyPrivacy)
     * If one rule matches, the request is labeled as tracking request.      
     * For each node the ratio between tracking requests and all incoming 
     * requests (count) is calculated.
     */
    tracking: {
      'extract': (r, acc) => {
        let isTracking = r.labels
          .reduce((acc, val) =>
            acc || val.isLabeled,
            false
          );

        return Util.count(isTracking, acc);
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    },

    /**
     * @desc First-party is contained in HTTP/S request
     * **NOTE:**
     * Currently, we only check if the Referer or Origin header is set.
     * The URL can be contained in the query string or even path (URL- or Base64 encoded).
     * For each node the ratio between requests in which the first-party had been contained
     * and all incoming requests is calculated.
     */
    firstPartyDisclosed: {
      'extract': (r, acc) => {
        let referer = Util.header(r.requestHeaders, 'referer');
        let origin = Util.header(r.requestHeaders, 'origin');
        return Util.count(referer || origin, acc);
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    },

    /**
     * @desc Number of cookies set per in-neighbor
     */
    cookiesSet: {
      'extract': (r, acc) => {
        return Util.count(
          Util.header(r.response.responseHeaders, 'set-cookie'),
          acc
        );
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.indegree);
      }
    },

    /**
     * @desc Ratio between third-party-cookies and all cookies 
     */
    thirdPartyCookie: {
      'extract': (r, acc) => {
        let target = getDomain(new URL(Util.target(r)).hostname);
        let source = getDomain(new URL(Util.source(r)).hostname);
        let cookieSet = Util.header(r.response.responseHeaders, 'set-cookie');
        return ((target != source) && cookieSet) ? acc + 1 : acc;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.cookiesSet);
      }
    },

    /**
     * @desc Average URL length
     */
    avgUrlLength: {
      'extract': (r, acc) => {
        return acc + Util.target(r).length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    },

    /**
     * @desc Average HTTP/S requests per in-neighbors
     */
    avgReqPerNeighbor: {
      'extract': (r, acc) => null,
      'set': (feature, attrs) => {
        return Util.ratio(attrs.count, attrs.indegree);
      }
    },

    /**
     * @desc Average number of query parameters per HTTP/S request
     */
    avgQpPerReq: {
      'extract': (r, acc) => {
        return acc + Util.params(r).length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    },

    /**
     * @desc Average number of query parameters per in-neighbor
     */
    avgQpPerNeighbor: {
      'extract': (r, acc) => {
        return acc + Util.params(r).length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.indegree);
      }
    },

    /**
     * @desc Average number of HTTP/S request headers per request
     */
    avgRhPerRq: {
      'extract': (r, acc) => {
        return acc + r.requestHeaders.length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    },

    /**
     * @desc Average number of HTTP/S request headers per in-neighbor
     */
    avgRhPerNeighbor: {
      'extract': (r, acc) => {
        return acc + r.requestHeaders.length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.indegree);
      }
    },

    /**
     * @desc Average number of HTTP/S response headers per request
     */
    avgRespHPerRq: {
      'extract': (r, acc) => {
        return acc + r.response.responseHeaders.length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    },

    /**
     * @desc Average number of HTTP/S response headers per in-neighbor
     */
    avgRespHPerNeighbor: {
      'extract': (r, acc) => {
        return acc + r.response.responseHeaders.length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.indegree);
      }
    },

    /**
     * @desc Average number of HTTP/S cookies per request
     */
    avgCookieFieldsPerRq: {
      'extract': (r, acc) => {
        return acc + Util.cookie(r).length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    },

    /**
     * @desc Average number of HTTP/S cookies per in-neighbor
     */
    avgCookieFieldsPerNeighbor: {
      'extract': (r, acc) => {
        return acc + Util.cookie(r).length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.indegree);
      }
    },

    /**
     * @desc Maximum subdomain depth
     */
    maxSubdomainDepth: {
      'extract': (r, acc) => {
        let hostname = new URL(Util.target(r)).hostname;
        let sld = getDomain(hostname);
        let subdomain = hostname
          .split(sld)
          .filter(Boolean);

        if (subdomain.length === 0) {
          return acc;
        } else {
          let depth = subdomain
            .shift()
            .split('.')
            .filter(Boolean)
            .length;

          return Util.max(acc, depth);
        }
      },
      'accumulate': (x, y) => {
        return Util.max(x, y);
      },
      'set': (feature, attrs) => {
        return attrs[feature];
      }
    },

    /**
     * @desc Average length of subdomain
     * **NOTE:** dots are included in the length
     */
    avgSubdomainLength: {
      'extract': (r, acc) => {
        let hostname = new URL(Util.target(r)).hostname;
        let sld = getDomain(hostname);
        let subdomain = hostname
          .split(sld)
          .filter(Boolean);

        return (subdomain.length === 0)
          ? acc
          : acc + subdomain[0].length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    },

    /**
     * @desc Average HTTP/S path length
     */
    avgPathLength: {
      'extract': (r, acc) => {
        let path = new URL(Util.target(r)).pathname;
        return acc + path.length;
      },
      'set': (feature, attrs) => {
        return Util.ratio(attrs[feature], attrs.count);
      }
    }

  };

})();