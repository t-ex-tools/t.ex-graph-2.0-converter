import fs from 'fs';
import JSONStream from 'JSONStream';
import gexf from 'graphology-gexf';
import Util from './Util.js';
import Wdg from './Wdg.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default (() => {

  return {
    gexf(dir, options) {
      let path = Util.path(dir);
      if (!path) {
        console.log('Error: files not found at ' + path);
        process.exit(1);
      }

      if (!Util.isDir(path)) {
        console.log('Error: ' + path + ' is not a directory');
        process.exit(1);
      }

      let files = Util.batches(path);
      if (files.length === 0) {
        console.log('Error: ' + path + ' contains no JSON files');
        process.exit(1);
      }

      let output = options.output;
      const writeStream = fs
        .createWriteStream(output);    

      const log = Array(files.length).fill(0);

      const graph = new Wdg();

      files
        .forEach((file, idx) => {

          const pipeline = fs
            .createReadStream(path + file)
            .pipe(JSONStream.parse('*'));

          pipeline.on('data', (r) => {
            log[idx] += 1;
            if (!options.silent) {
              console.clear();
              console.log(log.reduce((acc, val) => acc + val, 0));  
            }

            graph.process(r, options);
          });

          pipeline.on('end', () => {
            if (idx === files.length-1) {
              graph.attributes();
              let o = gexf.write(graph.get());
              writeStream.write(o);
              writeStream.close();
            }
          });
          
        })

    },
  }

})();