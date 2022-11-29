import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default (() => {

  return {

    count: (condition, value) => {
      return (condition)
        ? value + 1
        : value;
    },

    add: (x, y) => {
      return x + y;
    },

    zeroOrOne: (condition) =>
      (condition) ? 1 : 0,

    ratio: (dividend, divisor) => {
      return (divisor > 0) 
        ? dividend / divisor
        : 0;
    },

    max: (x, y) => {
      return Math.max(x, y);
    },

    header(headers, key) {
      return headers.find((h) => h.name.toLowerCase() === key.toLowerCase())
    },

    params(r) {
      let u = new URL(this.target(r));
      return (u.searchParams)
        ? [...u.searchParams.entries()]
        : []
    },

    cookie(r) {
      let c = this.header(r.requestHeaders, 'cookie');
      return (c) 
        ? c.value.split(";").map((el) => el.trim().split("="))
        : [];
    },

    target(r) {
      if (r.url) {
        return r.url;
      } else if (r.response) {
        if (r.response.url) {
          return r.response.url;
        }
      }    
    },
    
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

    path(dir) {
      return (fs.existsSync(dir)) 
        ? dir
        : (fs.existsSync(__dirname + '/' + dir))
          ? rel
          : null;    
    },

    isDir(path) {
      return fs
        .lstatSync(path)
        .isDirectory();
    },

    batches(path) {
      return fs
        .readdirSync(path)
        .filter((file) => file.endsWith('.json'));
    },

  };

})();