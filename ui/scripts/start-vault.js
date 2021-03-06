#!/usr/bin/env node

if(process.argv[2]){
  process.kill(process.argv[2], 'SIGINT');
  process.exit(0);
}

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var vault = spawn(
  'vault',
  [
    'server',
    '-dev',
    '-dev-ha',
    '-dev-transactional',
    '-dev-leased-kv',
    '-dev-root-token-id=root',
    '-dev-listen-address=127.0.0.1:9200'
  ]
);

// https://github.com/chalk/ansi-regex/blob/master/index.js
var ansiPattern = [
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))'
].join('|');

var ANSI_REGEX = new RegExp(ansiPattern, 'g');

var output = '';
var unseal, root;
vault.stdout.on('data', function(data) {
  var stringData = data.toString().replace(ANSI_REGEX, '');
  output = output + stringData;
  console.log(stringData);

  var unsealMatch = output.match(/Unseal Key\: (.+)$/m);
  if (unsealMatch && !unseal) { unseal = unsealMatch[1] };
  var rootMatch = output.match(/Root Token\: (.+)$/m);
  if (rootMatch && !root) { root = rootMatch[1] };
  if (root && unseal) {
    fs.writeFile(
      path.join(process.cwd(), 'tests/helpers/vault-keys.js'),
      `export default ${JSON.stringify({ unseal:unseal, root:root }, null, 2)}`
    );

    console.log('VAULT SERVER READY');
  }
});

vault.stderr.on('data', function(data) {
  console.log(data.toString());
});

vault.on('close', function(code) {
  console.log(`child process exited with code ${code}`);
  process.exit();
});
vault.on('error', function(error) {
  console.log(`child process errored: ${error}`);
  process.exit();
});


var pidFile = 'vault-ui-integration-server.pid';
process.on('SIGINT', function() {
  vault.kill('SIGINT');
  process.exit();
});
process.on('exit', function() {
  vault.kill('SIGINT');
});

fs.writeFile(pidFile, process.pid);
