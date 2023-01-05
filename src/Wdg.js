import Graph from 'graphology';
import validator from 'validator';
import pkg from 'tldjs';
const { getDomain } = pkg;

import Features from "./Features.js";
import Util from "./Util.js";

const urlOptions = { 
  protocols: ['http', 'https'], 
  require_protocol: true,
};


/**
 * @class Wdg
 * @desc Class ``Wdg`` which stands for weighted directed graph.
 * @returns {Object} A graph generated with ``graphology``.
 * See {@link https://www.npmjs.com/package/graphology|graphology} for more details.
 */
export default function() {

  /**
   * @constant
   * @type {Object}
   * @default
   * @memberof Wdg
   * @desc Instance of a class ``Graph`` from ``graphology``. 
   */
  const graph = new Graph();

  return {

    /**
     * @function
     * @memberof Wdg
     * @desc A getter function to retrieve the graph instance.
     * @returns Returns the graph instance.
     */
    get() {
      return graph;
    },

    /**
     * Adds a node to the graph instance.
     * @memberof Wdg
     * @param {String} node The domain name of a node 
     * (
     * {@link https://en.wikipedia.org/wiki/Fully_qualified_domain_name|FQDN} 
     * or 
     * {@link https://en.wikipedia.org/wiki/Second-level_domain|SLD}
     * ).
     * @param {Object} attrs The attributes of the node.
     */
    addNode(node, attrs) {
      if (!graph.hasNode(node)) {
        graph.addNode(node, attrs);
      } else {
        graph.updateNode(node, (attr) => Object.assign(attr, attrs));
      }
    },

    /**
     * Adds an edge from ``source`` to ``target`` to the graph instance.
     * In case the edge already exists, the edge is updated.
     * @memberof Wdg
     * @param {String} source The domain name of the source node
     * (
     * {@link https://en.wikipedia.org/wiki/Fully_qualified_domain_name|FQDN} 
     * or 
     * {@link https://en.wikipedia.org/wiki/Second-level_domain|SLD}
     * ).
     * @param {String} target The domain name of the target node
     * (
     * {@link https://en.wikipedia.org/wiki/Fully_qualified_domain_name|FQDN} 
     * or 
     * {@link https://en.wikipedia.org/wiki/Second-level_domain|SLD}
     * ).
     * @param {Object} r An HTTP/S request retrieved from the ``webRequest`` interface. 
     * See {@link https://developer.chrome.com/docs/extensions/reference/webRequest/#event-onBeforeRequest|webRequest.onBeforeRequest()}
     * for more details.
     */
    addEdge(source, target, r) {
      if (!graph.hasEdge(source, target)) {
        
        let attrs = Object
          .keys(Features)
          .reduce((acc, val) => {
            acc[val] = Features[val].extract(r, 0);
            return acc;
          }, {})

        graph.addEdge(source, target, attrs);

      } else {
        
        graph.updateEdge(source, target, (attr) => {
          let attrs = Object
            .keys(Features)
            .reduce((acc, val) => {
              acc[val] = Features[val].extract(r, attr[val]);
              return acc;
            }, {})

          return attrs;
        });

      }
    },

    /**
     * A function to retrieve a specific edge between ``source`` and ``target``.
     * @memberof Wdg
     * @param {String} source The domain name of the source node
     * (
     * {@link https://en.wikipedia.org/wiki/Fully_qualified_domain_name|FQDN} 
     * or 
     * {@link https://en.wikipedia.org/wiki/Second-level_domain|SLD}
     * ).
     * @param {String} target The domain name of the target node
     * (
     * {@link https://en.wikipedia.org/wiki/Fully_qualified_domain_name|FQDN} 
     * or 
     * {@link https://en.wikipedia.org/wiki/Second-level_domain|SLD}
     * ).
     * @returns {Object} Returns the requested edge in case it exists. Returns ``undefined`` otherwise.
     */
    getEdge(source, target) {
      return graph.edge(source, target);
    },

    /**
     * A method to process a single HTTP/S request from the dataset. 
     * The processing includes the following steps:
     * 1. Extract ``source`` and ``target`` using 
     * {@link module:Util.source|``Util.source()``} and 
     * {@link module:Util.target|``Util.target()``}, respectively.
     * 2. Check whether ``source`` and ``target`` are valid URLs using 
     * {@link https://www.npmjs.com/package/validator|``validator``}.
     * 3. Extract the FQDNs of ``source`` and ``target``. 
     * 4. Extract the SLDs of ``source`` and ``target`` using
     * {@link https://www.npmjs.com/package/tldjs|``tldjs``}.
     * 5. Determine whether ``r`` is a first-party or third-party request.
     *    Discard all first-party requests unless option ``firstParty === true``.
     * 6. In case option ``sld === true`` use the extracted SLDs of ``source`` and ``target``
     *    as the node names. Use the FQDNs of ``source`` and ``target`` otherwise.
     * 7. Add nodes and edge using {@link Wdg.addNode|``Wdg.addNode``} and {@link Wdg.addEdge|``Wdg.addEdge``}.
     * @memberof Wdg
     * @param {Object} r An HTTP/S request retrieved from the ``webRequest`` interface. 
     * See {@link https://developer.chrome.com/docs/extensions/reference/webRequest/#event-onBeforeRequest|webRequest.onBeforeRequest()}
     * for more details.
     * @param {Object} options Options object passed by ``commander`` to this function.
     * See {@link https://www.npmjs.com/package/commander#options} for more details.
     */
    process(r, options) {
      let target = Util.target(r);
      let source = Util.source(r);

      // We only process requests that have valid URLs for source and target
      if (!validator.isURL(new String(source), urlOptions) ||
          !validator.isURL(new String(target), urlOptions)) {
            return;
          }

      source = new URL(source).hostname;
      target = new URL(target).hostname;

      let sldSource = getDomain(source);
      let sldTarget = getDomain(target);
      let isFp = sldSource === sldTarget;

      // We only process third-party requests (!)
      // We deem all first-party requests as benign,
      // thus, neglecting any first-party tracking.
      if (isFp && !options.firstParty) {
        return;
      }

      if (options.sld) {
        source = sldSource;
        target = sldTarget;
      }

      this.addNode(source, { label: source });
      this.addNode(target, { label: target });
      this.addEdge(source, target, r);
    },

    /**
     * A method to compute the **node attributes** for a graph instance.
     * **NOTE:** This method is called after all HTTP/S request have been processed
     * using {@link Wdg.process|``Wdg.process``}.
     * @method
     * @memberof Wdg
     */
    attributes() {
      graph
        .forEachNode((node, attrs) => {
          let features = graph
            .reduceInEdges(
              node, 
              (acc, edge, attr) => {
                Object
                  .keys(attr)
                  .forEach((key) => {
                    if (Features[key].accumulate) {
                      acc[key] = Features[key].accumulate(acc[key], attr[key]);
                    } else {
                      acc[key] = acc[key] + attr[key];
                    }
                  })
                
                return acc;
              },
              {
                ...Object
                  .keys(Features)
                  .reduce((acc, val) => {
                    acc[val] = 0;
                    return acc;
                  }, {})
              }
            );

            let indegree = graph.inDegree(node);
            Object
              .keys(features)
              .forEach((feature) => {
                graph.setNodeAttribute(
                  node, 
                  feature, 
                  Features[feature]
                    .set(
                      feature, 
                      {
                        ...features,
                        indegree
                      }
                    )
                );
              });
        })
    }

  };

};