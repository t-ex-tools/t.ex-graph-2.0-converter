import fs from 'fs';
import JSONStream from 'JSONStream';
import gexf from 'graphology-gexf';
import Util from './Util.js';
import Wdg from './Wdg.js';

/**
 * A module to handle command-line interface commands.
 * @module Controller
 */
export default {

  /**
   * @desc Method ``gexf()`` to handle the command gexf.
   * @param {String} dir - Relative or absolute path to the exported JSON files generated by T.EX.
   * @param {Object} options - Options object passed by ``commander`` to this function.
   * See {@link https://www.npmjs.com/package/commander#options} for more details.
   * @method
   */
  gexf: function(dir, options) {
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

    this.process(path, files, options);
  },

  process: function(path, files, options) {

    let streams = files.map((file) => fs.createReadStream(path + file));
    streams.push(fs.createWriteStream(options.output));

    this.pipe(streams, 0, {
      graph: new Wdg(),
      options, 
      log: Array(files.length).fill(0)
    });
  },

  pipe: async function(streams, idx, ctx) {
    
    let out = streams[streams.length - 1];
    let pipeline = streams[idx].pipe(JSONStream.parse('*'));

    pipeline.on('data', async (r) => {
      
      ctx.log[idx] += 1;
      if (!ctx.options.silent) {
        console.clear();
        console.log(ctx.log.reduce((acc, val) => acc + val, 0));
      }

      await ctx.graph.process(r, ctx.options);
    });
    
    if (idx < streams.length - 2) {
      pipeline.on('end', () => this.pipe(streams, idx + 1, ctx));
    }

    if (idx === streams.length - 2) {
      pipeline.on('end', async () => {
        Promise.resolve(ctx.graph.attributes())
          .then((graph) => {
            let o = gexf.write(ctx.graph.get());
            out.write(o);
            out.close();  
          });
      });
    }
  },  

};