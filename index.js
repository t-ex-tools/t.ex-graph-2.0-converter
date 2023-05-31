import { program } from 'commander';
import Controller from './src/Controller.js';

/**
 * Program definition: t.ex-graph-converter
 * Version: 1.0.0
 */
program
  .name('t.ex-graph-converter')
  .description('A tool to convert labeled data sets generated by T.EX to t.ex-Graph in the GEXF format.')
  .version('1.0.0');

/**
 * CLI-Command definition: gexf
 * Description: Convert exported JSON files to t.ex-graph in the GEXF format.
 * Arguments: dir
 * Options: output, sld, first-party, silent
 */
program.command('gexf')
  .description('Convert exported JSON files to t.ex-graph in the GEXF format.')
  .argument('<dir>', 'path to JSON files')
  .option('-o, --output <file>', 'name of the output file created in current working directory', 'output.gexf')
  .option('--sld', 'in case nodes should be second level domains instead of fully qualified domain names')
  .option('-fp, --first-party', 'include first-party requests to generate nodes and edges')
  .option('-s, --silent', 'disable progress indicator printing on console')
  .action((dir, options) => Controller.gexf(dir, options));

program.parse();