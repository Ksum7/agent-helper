const http = require('http');
const vm = require('vm');
const url = require('url');

const PORT = 3001;
const MAX_CODE_LENGTH = 10000;
const MAX_OUTPUT_LENGTH = 4000;
const EXECUTION_TIMEOUT = 5000;

const createSandbox = () => {
  const logs = [];
  const console_mock = {
    log: (...args) => {
      const msg = args.map(arg => String(arg)).join(' ');
      logs.push(msg);
    },
    warn: (...args) => {
      const msg = '[warn] ' + args.map(arg => String(arg)).join(' ');
      logs.push(msg);
    },
    error: (...args) => {
      const msg = '[error] ' + args.map(arg => String(arg)).join(' ');
      logs.push(msg);
    },
  };

  const sandbox = {
    console: console_mock,
    Math,
    JSON,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Proxy,
    Reflect,
    Symbol,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
  };

  return { sandbox: vm.createContext(sandbox), logs };
};

const executeCode = (code) => {
  if (code.length > MAX_CODE_LENGTH) {
    return {
      error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`,
      output: '',
    };
  }

  try {
    const { sandbox, logs } = createSandbox();
    const result = vm.runInContext(code, sandbox, { timeout: EXECUTION_TIMEOUT });
    const output = logs.join('\n').slice(0, MAX_OUTPUT_LENGTH);

    return {
      output,
      result: String(result),
    };
  } catch (err) {
    const errorMsg = err.message || String(err);
    return {
      error: errorMsg,
      output: '',
    };
  }
};

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/execute') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
    if (body.length > 50000) {
      req.connection.destroy();
    }
  });

  req.on('end', () => {
    try {
      const { code } = JSON.parse(body);
      if (typeof code !== 'string') {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'code must be a string' }));
        return;
      }

      const result = executeCode(code);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid request body' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Sandbox server listening on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
