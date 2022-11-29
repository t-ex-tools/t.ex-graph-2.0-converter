import fs from 'fs';
import Util from "./Util.js";
import pkg from 'tldjs';
const { getDomain } = pkg;

const requestTypes = JSON.parse(fs.readFileSync('src/assets/request.types.json'));
const requestMethods = JSON.parse(fs.readFileSync('src/assets/request.methods.json'));

const stringComparison = (extractedValue, seekedValue) => {
  if (extractedValue && seekedValue) {
    return extractedValue.toLowerCase() === seekedValue.toLowerCase();
  } else {
    return false;
  }
};

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
     * Features: HTTP/S request method and type
     * ---
     * HTTP/S method:
     * see: https://developer.chrome.com/docs/extensions/reference/webRequest/#event-onBeforeRequest
     * NOTE: 
     * callback parameter details.method: "Standard HTTP method."
     * ---
     * HTTP/S request type:
     * see: https://developer.chrome.com/docs/extensions/reference/webRequest/#type-ResourceType
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
     * Features: HTTP/S request count
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
     * Ground Truth: Tracking requests count
     * NOTE: 
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
     * Feature: First-party is contained in HTTP/S request
     * NOTE:
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
     * Feature: Number of cookies set per in-neighbor
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
     * Feature: Ratio between third-party-cookies and all cookies 
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
     * Feature: Average URL length
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
     * Feature: Average HTTP/S requests per in-neighbors
     */
    avgReqPerNeighbor: {
      'extract': (r, acc) => null,
      'set': (feature, attrs) => {
        return Util.ratio(attrs.count, attrs.indegree);
      }
    },

    /**
     * Feature: Average number of query parameters per HTTP/S request
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
     * Feature: Average number of query parameters per in-neighbor
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
     * Feature: Average number of HTTP/S request headers per request
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
     * Feature: Average number of HTTP/S request headers per in-neighbor
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
     * Feature: Average number of HTTP/S response headers per request
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
     * Feature: Average number of HTTP/S response headers per in-neighbor
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
     * Feature: Average number of HTTP/S cookies per request
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
     * Feature: Average number of HTTP/S cookies per in-neighbor
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
     * Feature: Maximum subdomain depth
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
     * Feature: Average length of subdomain
     * NOTE: dots are included in the length
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
     * Feature: Average HTTP/S path length
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