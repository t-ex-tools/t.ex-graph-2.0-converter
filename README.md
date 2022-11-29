# Installation

To use t.ex-Graph, you need to install Node.js (ideally v16+) and npm (ideally v8+). Use the following command to install the dependencies.

```npm install```

Afterwards you can convert HTTP/S requests to t.ex-Graph with the following command:

```node index.js gexf examples\ -o examples\output.gexf```

## Manual

```
Usage: t.ex-graph [options] [command]

A tool to convert labeled data sets generated by T.EX to a GEXF file.

Options:
  -V, --version         output the version number       
  -h, --help            display help for command        

Commands:
  gexf [options] <dir>  Convert an exported JSON file to a GEXF file.
  help [command]        display help for command

Usage: t.ex-graph gexf [options] <dir>

Convert an exported JSON file to a GEXF file.

Arguments:
  dir                  path to JSON files

Options:
  -o, --output <file>  name of the output file created in current working directory (default: "output.gexf")    
  --sld                in case nodes should be second level domains instead of fully qualified domain names     
  -fp, --first-party   include first-party requests to generate nodes and edges
  -s, --silent         disable progress indicator printing on console
  -h, --help           display help for command  
```

# Concept: t.ex-Graph

## Relationships Between Hosts

An HTTP/S request is always addressed to a specific *target* host. Most requests, however, are not initiated by users, e.g., when they enter a URL into the address bar, but by the browser, which assembles the requested website (in the following *first party*) by fetching multiple resources often from completely different hosts (in the following *third party* or *third parties*).

For these browser-initiated HTTP/S requests, we can model the first party as *source* of a request. Together with the *target* address, we derive a directed graph $G := (V, E)$ with hosts as vertices and requests as edges. Assuming a website ```a.com```, which embeds an image of website ```b.com```, then ```a.com```, ```b.com``` $\in V$ and $((source, $```a.com```$), (target, $ ```b.com```$)) \in E$.

Hosts are addressed by fully qualified domain names (FQDN), which includes the second-level domain (SLD) of a host. All reachable subdomains (or FQDNs) share one SLD. The structure of the graph $G$ and its properties vary, depending on how we model hosts, either as FQDNs or SLDs, thus, we derive two variants of the graph: $G_{FQDN} := (V_{FQDN}, E_{FQDN})$ and $G_{SLD} := (V_{SLD}, E_{SLD})$. Consider a website ```c.com```, which embeds an image from ```image.d.com```, then $((source, $```c.com```$), (target, $ ```image.d.com```$)) \in E_{FQDN}$, but $((source, $```c.com```$), (target, $ ```d.com```$)) \notin E_{FQDN}$. However, for $G_{SLD}$ $((source, $```c.com```$), (target, $ ```d.com```$)) \in E_{FQDN}$ applies. On a more abstract level, $G_{SLD}$ is an aggregation of $G_{FQDN}$.

We only consider edges where $source \neq target$, consequently, nodes do not have self-loops and nodes with no edge to another target are neglected (i.e. $\notin V$). Generally speaking, we deem first party requests benign and only third party requests as potential tracking requests. The motivation for this is that Web trackers like advertising networks or analytics provider have websites themselves, which a user might intend to visit. The first party communication in this context is benign, however, in a different context (i.e. while visiting a different website) might not. The edge attributes of self-loops would add noise to the node attributes, which could affect the results of our classifier. Nodes with no connection to another node but itself can be considered *harmless* in a sense that the website visit causes no data flow to third parties. However, the website might still be malicious beyond the capabilities of Web tracking (e.g. malware or crypto mining scripts).

## Modeling Data Flows

![image](./t.ex-graph.svg)

The goal of our graph is to represent the data flows between hosts. Hence, we compute attributes of edges, which, in a second step, are accumulated at the nodes of the graph. We extend our vertices $v \in V$ and edges $e \in E$ by a tuple $attrs$. The attributes at the edge level are derived from the HTTP/S requests and can be *counts*, *sums* (e.g., of URL lengths), or *maxima* of features of a request. The edge attributes are aggregated at node level. We, therefore, accumulate for each node the attributes of all *incoming* edges. For this, we either derive the *sum*, a *maxima*, or a *boolean* value encoded in ```0``` (for ```false```) or ```1``` (for ```true```). Sums of features can be further divided by the number of requests or number of in-neighbors.

See Figure [ref] for an example: the graph has four nodes (```a.com```, ```b.com```, ```c.com```, and ```d.com```) and four edges. We define $e_{a \rightarrow b}$ as the edge $((source, $```a.com```$), (target, $```b.com```$), (attrs, (2, 0, 3))) \in E$ and the reamining edges analogously. The first entry of the tuple $attrs$ is a count, the second a boolean value, and the third a sum. The node attributes for ```a.com``` and ```c.com``` are $(0, 0, 0)$, since these nodes have no incoming edges. The first entry of the node attributes is the average of all first entries of edge attributes, the second uses the $OR$ operator, and the third is chosing the maximum, analogously. Thus, the node attributes of ```b.com``` and ```d.com``` are $(4, 1, 7)$ and $(2.5, 1, 4)$, respectively.

## Edge and Node Attributes

Generally, in an HTTP/S request, there are five elements of an HTTP message, in which arbitrary data can be transmitted: (i) the HTTP body as most obvious, (ii) the URL itself (as part of a dynamic path), (iii) the query parameters (or search string), and (iv) the request headers including (v) the cookie fields. We further consider the HTTP/S response, since it can hold valuable information about the target host. Although technically, this constitutes a data flow from target to source, we see the response as deterministic part of a request. See below a detailed list of attributes we compute for each node:

* **count** - The total number of HTTP/S requests a host retrieves from all its in-neighbors.

* **tracking** - The total number of tracking requests a host retrieves divided by *count*.

* **requestType** - The interface ```webRequest``` of the WebExtensions standard classifies each HTTP/S request into one of the following categories:  ```xmlhttprequest ```, ```image ```, ```font ```, ```script ```, ```stylesheet ```, ```ping ```, ```sub_frame ```, ```other ```, ```main_frame ```, ```csp_report ```, ```object ```, ```media ``` [[source](https://developer.chrome.com/docs/extensions/reference/webRequest/#type-ResourceType)]. For each request type we compute the total number of requests with that specific type and divide it by *count*. Consequently, we compute for each type a separate node attribute.

* **requestMethod** - For each HTTP method we compute the total number of requests (issued with the respective request method) and divide it by *count*. HTTP request methods are: ```GET```, ```HEAD```, ```POST```, ```PUT```, ```DELETE```, ```CONNECT```, ```OPTIONS```, ```TRACE```, and ```PATH``` [[source](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)]. Analogously to *requestType*, we compute a distinct node attribute for each type.

* **firstPartyDisclosed** - We count the number of HTTP/s request in which the first party is disclosed to the third party via the ```Referer``` or ```Origin``` header. This number is divided by *count* to compute the ratio between requests in which the target knows the source and the total number of requests.

* **cookiesSet** - We count the number of cookies set by a node and divide this number by the indegree of the node.

* **thirdPartyCookie** - We count the number of third party cookies (i.e., $source \neq target$) set by a node. This count is divided by the total number of cookies set by the respective node. To be more precise, we compute the ratio between third party cookies and all cookies set by a node.

* **avgUrlLength** - The average URL length of all incoming requests. For this, we sum up the lengths of all URLs targeted to a specific host (node) and divide it by *count*.

* **avgReqPerNeighbor** - The average number of incoming HTTP/S requests per in-neighbor. For this, the *count* of a node is divided by the indegree of it.

* **avgQpPerReq** - The number of query parameters of all incoming HTTP/s requests are summed up and dived by *count*.

* **avgQpPerNeighbor** - Analogously to *avgQpPerRq*, we sum up the number of query parameters transmitted to a node and divide the sum by the indegree.

* **avgRhPerRq** - The average number of request headers per HTTP/S request. We sum up the number of header fields transmitted to the target and divide it by *count*.

* **avgRhPerNeighbor** - The average number of request headers per in-neighbor, which is analogously computed to *avgRhPerRq*, but divided by the indegree of a node.

* **avgRespHPerRq** - The average number of response headers per HTTP/S request analogously computed to *avgRhPerRq*.

* **avgRespHPerNeighbor** - The average number of response headers per in-neighbor analogously computed to *avgRhPerNeighbor*.

* **avgCookieFieldsPerRq** - The average number of cookie fields per HTTP/S requests analogously computed to *avgRhPerRq*.

* **avgCookieFieldsPerNeighbor** - The average number of cookie fields per in-neighbor analogously computed to *avgRhPerNeighbor*.

* **maxSubdomainDepth** - The maximum subdomain depth of a node. For $G_{FQDN}$ this depth equals the subdomain depth of the node itself, while for $G_{SLD}$ the deepest subdomain is computed from all incoming requests. As an example, consider ```a.b.c.d.com``` whose subdomain depth is $3$. In $G_{FQDN}$ ```a.b.c.d.com``` $\in V_{FQDN}$ applies, however, in $G_{SLD}$ the subdomain depth of ```d.com``` is $3$.

* **avgSubdomainLength** - The average subdomain length per HTTP/S request or, more precise, the ratio between subdomain lengths and *count*.

* **avgPathLength** - The average path length of an HTTP/S request. The ```pathname``` of a URL is the URL without the FQDN and the search string [[source](https://developer.mozilla.org/en-US/docs/Web/API/URL/pathname)].

## Centrality Metrics

We extend the node attributes by common graph centrality metrics, which we compute for each node. See below a list of the attributes:

* **in-**, **out-**, & **degree** - For each node the in-, out-, and degree centrality is computed.

* **eccentricity** - The *eccentricity* of a node $\epsilon(v)$ is defined by the greatest distance of a node to any other node. More precise, $\epsilon(v) := max \; d(v, u), \; \forall u \in V$, where $d(v, u)$ is the distance between two nodes.

* **closnesscentrality** - For each node $v$ there is a shortest path between $v$ and all other nodes in the network. The average of shortest path lengths between node $v$ and $u \in V$ is called the *closeness centrality* of node $v$.

* **harmonicclosnesscentrality** - The *harmonic closeness centrality* is a *closeness centrality* variant, which performs better on disconnected graphs. Usually, both metrics strongly correlate, however, our *t.ex-Graph* containts subgraphs, which are not connected, thus both metrics are considered.

* **betweenesscentrality** - The *betweeness centrality* identifies nodes, which serve as connection between two clusters. It is determined for each node $v$ by generating the shortest paths between all node pairs $(s, t) \in V$ and counting how often a node $v$ is included in the shortest path. This count is divided by the total number of shortest paths between $s$ and $t$.

* **eigencentrality** - The *eigenvector centrality* aims to rank nodes in the graph according to their *importance*. For this, the *importances* of the neighbors are also considered. 

* **hubs**, & **authorities** &  - The metrics *hub* and *authory* had been proposed by Kleinberg [[source](https://dl.acm.org/doi/10.1145/324133.324140)] in 1999 to, back then, rank websites. It is reasonable to apply this metric, which was designed for the Web, to our graph as well.

* **pageranks** - Similar to Kleinberg's intention, Page et al. [[source](http://ilpubs.stanford.edu:8090/422/)] implemented the famous *PageRank* algorithm in 1999 to rank websites according to their *relevance*. As an additional centrality metric specifically designed for the Web, we expect it to be well-suited for our goal.

* **componentnumber** & **strongcompnum** - Each node is assigned an ID of the *graph component* it is part of. Furthermore, each *strongly connected component* of the graph is identified and an ID is assigned to its member nodes. A component of a graph is an isolated subgraph, which has no connections to other subgraphs. A strongly connected component is a subgraph in which all member nodes are directly connected to each other, however, this subgraph might have connections to other strongly connected components.

* **modularity_class** - By computing the *modularity* of the graph, we identify communities (or clusters) within the graph. Each is defined by a class: the *modularity class*, which is assigned to all its member nodes.

* **stat_inf_class** - Another approach to detect communities in a graph is through statistical inference. We define *statistical inference classes*, which we assign to the corresponding nodes, analogously to the *modulartiy class*.

* **clustering** - We compute the *clustering coefficient* for each node $v$, which is defined by the ratio between the actual number of edges between all neighbors of $v$ and the total number of possible edges between all neighbors of $v$.