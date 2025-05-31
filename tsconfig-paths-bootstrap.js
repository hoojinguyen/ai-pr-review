const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('./tsconfig.json');

const baseUrl = './dist'; // This should point to the compiled output directory
const cleanup = tsConfigPaths.register({
  baseUrl,
  paths: tsConfig.compilerOptions.paths,
});

// When the module is unloaded, the registered hooks are removed
process.on('exit', cleanup);