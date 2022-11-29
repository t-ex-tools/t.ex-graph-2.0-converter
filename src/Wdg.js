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



export default function() {

  const graph = new Graph();

  return {

    get() {
      return graph;
    },

    addNode(node, attrs) {
      if (!graph.hasNode(node)) {
        graph.addNode(node, attrs);
      } else {
        graph.updateNode(node, (attr) => Object.assign(attr, attrs));
      }
    },

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

    getEdge(source, target) {
      return graph.edge(source, target);
    },

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
                      acc[key] = Util.add(acc[key], attr[key]);
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