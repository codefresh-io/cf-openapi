# CF-OPENAPI

#### Main goals:

1) `openapi.json` linting

2) micro-service startup initialization:
- expose `openapi.json` through `/api/openapi.json` endpoint
- expose `ReDoc` for `openapi.json` through `/api` endpoint
- expose `openapi.json` aggregated from dependency services through `/api/admin/openapi.json` endpoint
- expose `ReDoc` for aggregated `openapi.json` through `/api/admin` endpoint
- fetch dependency services' `openapi.json` specs on startup
- push `openapi.push` event with micro-service `openapi.json` on startup
- listen to `openapi.push` event for dependency services
- `(todo)` endpoints generation from `openapi.json`
- `(todo)` sdk generation for dependency services

## Usage

### Installation

`npm i @codefresh-io/cf-openapi`

`yarn add @codefresh-io/cf-openapi`

### Linter and validator

If you want to lint the `openapi.json` file:

```shell
npm i -g @codefresh-io/cf-openapi-validator

# validate and lint using default path ./openapi.json (relative to pwd)
cf-openapi-validator lint

# given a path
cf-openapi-validator lint ./some-openapi.json

# lint post-processed openapi file  (see: ./lib/components/Processor.component.js)
cf-openapi-validator lint -p 
```

##### NOTE: node version of env to which installed validator cli should be the same as project required node version

### Micro-service startup

#### Note: this functionality is already integrated into [@codefresh-io/service-base](https://github.com/codefresh-io/service-base)

#### Flow:

```ecmascript 6
const express = require('express');

const { openapi } = require('@codefresh-io/cf-openapi');
const eventbus = require('@codefresh-io/eventbus')
const config = require('./service.config');

const app = express();

const publishInterface = (serviceName, spec) => {
    return eventbus.publishEvent('openapi.push', {
        aggregateId: serviceName,
        props: {
            spec: JSON.stringify(spec)
        }
    }, true, true);
};

const subscribeInterface = (handler) => {
    eventbus.subscribe('openapi.push', (data) => {
        const serviceName = data.aggregateId;
        const spec = JSON.parse(data.props.spec);
        return Promise.resolve()
            .then(() => handler(serviceName, spec));
    });
};

openapi.init(config)
openapi.endpoints().addDependenciesSpecMiddleware(dependenciesMiddleware)
openapi.endpoints().register(app)
openapi.dependencies().fetch();
openapi.events().setPublishInterface(publishInterface)
openapi.events().setSubscribeInterface(subscribeInterface)

app.listen(8080);

openapi.events().subscribe();
openapi.events().publish();
```


#### Using multiple instances

Openapi is a "module-singleton" where all components are singletons. 
This covers most cases except services which consist of multiple app instances (for example `cf-api`).

For this exception use next code:

```ecmascript 6
const { openapi: first } = require('@codefresh-io/cf-openapi').getInstance('first');
const { openapi: second } = require('@codefresh-io/cf-openapi').getInstance('second');

first.init(serviceConfig_1)
second.init(serviceConfig_2)
```


#### Config

Config:

```ecmascript 6
{
    name: PIPELINE_MANAGER, // service name (required)
    root: APP_ROOT, // root path from which openapi.json lookup will be performed
    openapi: {
        spec: {
            specPath: '/api/openapi.json', // default
            redocPath: '/api', // default
            filename: './openapi.json' // default
        },
        dependenciesSpec: {
            specPath: '/api/admin/openapi.json' // default
            redocPath: '/api/admin' // default
        }
    } 
}
```

Use `false` value to explicitly disable `spec` or `dependenciesSpec`:
```ecmascript 6
{
    openapi: {
        spec: false,
    }
}
```

##### Note: since all `openapi` properties are default the whole `openapi` property can be omitted

Dependency services are described inside the `openapi.json` using `x-internal-services` field:

```json
{
  "openapi": "3.0.0",
  "info": {...},
  "x-internal-services": [
    "pipeline-manager"
  ]
}
```

Service names are validated through [@codefresh-io/internal-service-config](https://github.com/codefresh-io/internal-service-config).
See the [readme](https://github.com/codefresh-io/internal-service-config) for available service names.


### Using endpoints

#### Handler

In the regular express application you do:
```ecmascript 6
// path: /app/controllers/some-endpoint.controller.js

class Controller {
    handleSomething(req, res, next) {
        console.log(req.params.myParam);
        // do some logic here
        res.send({ /*...*/ })
    }
}

module.exports = new Controller();
```

```ecmascript 6
// path: /app/index.js
const express = require('express');
const someEndpoint = require('./controllers/some-endpoint.controller.js')

const app = express();


app.get('/api/some/endpoint/:myParam', someEndpoint.handleSomething);

app.listen(8080);
```

Using cf-openapi you will do the same routing using `openapi.json` file located on
the root level of the directory with your app. The root dir will be scanned recursively for 
files with `*.controller.js`, `*.middleware.js` and `*.condition.js` endings
to load the 

##### NOTE: you need to follow the next rules:
```
1) follow the naming convention: *.controller.js, *.middleware.js and *.condition.js
2) these files should return an instance of class or an object with functions
```

Here you can see the same routing configuration as in the example above:

```json
// path: /app/openapi.json

{
  "openapi": "3.0.0",
  "info": {
    /*...*/
  },
  "x-base-path": "/api",  // this is used as base path for all registered endpints
  "paths": { // will be used as route: app.get('/some/endpoint', someEndpoint.handleSomething), 
    "/some/endpoint/{myParam}": { // this will be used to get the param by name: req.params.myName
      "get": {
        "tags": [],
        "operationId": "some-endpoint", // you always need to specify this (it's for api docs)
        "x-sdk-interface": "someEndpoint.requestHandleSomething", // this field is also required for skd usage like: sdk.someEndpint.requestHandleSomething()
        "parameters": [
          {
            "in": "path",
            "name": "myParam",
            "schema": {
              "type": "string"
            },
            "required": true
          }
        ],
        "x-endpoint": { // this is used to configure routing
          // this means that method handle something will call res.send() function
          // otherwise handleSomething() should return a value
          "isEndpoint": false,
          "preMiddleware": [],
          "postMiddleware" [],
          "handler": "some-endpoint.handleSomething" // this means:  get some-endpoint.controller.js file and use method handleSomething
        },
        "responses": {
          /*...*/
        }
      }
    }
  }
}

```

```ecmascript 6
// path: /app/controllers/some-endpoint.controller.js

class Controller {
    handleSomething(req, res, next) {
        console.log(req.params.myParam);
        // do some logic here
        res.send({ /*...*/ })
    }
}

// or return the value if isEndpoint is not specified or true
// -- return value will be sent automatically

class Controller {
    handleSomething(req) {
        console.log(req.params.myParam);
        // do some logic here
        return { /*...*/ }
    }
}

module.exports = new Controller();
```

```ecmascript 6
// path: /app/index.js

const express = require('express');
const { openapi } = require('@codefresh-io/cf-openapi');
const app = express();

openapi.endpoints().init(app);

app.listen(8080);
```

#### Middleware

If you want to add middleware to your route like:

```ecmascript 6
app.get('/some/endpoint/:myParam',
    (req, res, next) => {
        console.log(req.params.myParam);
        next();
    },
    someEndpoint.handleSomething,
)
```

You should add `logic.middleware.js` file:

```ecmascript 6
// path: /app/logic.middleware.js

module.exports = {
    logMyParam(req, res, next) {
        console.log(req.params.myParam);
        next();
    }
}
```

and following configuration:
```json
"x-endpoint": {
  "preMiddleware": [
        "logic.logMyParam"
  ],
  "postMiddleware" [],
  "handler": "some-endpoint.handleSomething"
},
```

##### NOTE: same should be applied if you want to use error middleware in `postMiddleware` array 

#### Condition

If you want to add some condition on process env which will disable endpoint:

```ecmascript 6
const { DISABLE_MY_ENDPOINT } = process.env;

if (DISABLE_MY_ENDPOINT !== 'true') {
    app.get(/*....*/)
}
```

Then you should create `env.condition.js` file:

```ecmascript 6
// path /app/env.condition.js

module.export = {
    // should only return true or false
    shouldEnableMyEndpoint() {
        return process.env.DISABLE_MY_ENDPOINT !== 'true'
    }
}
```

and following configuration:

```json
"x-endpoint": {
  "preMiddleware": [],
  "postMiddleware" [],
  "condition": "env.shouldEnableMyEndpoint" // if true -- endpoint will be loaded
  "handler": "some-endpoint.handleSomething"
},
```


#### More information

This doc is not yet finished -- for more info please refer to:

```
cf-openapi/__tests__/__app__

and 

cf-openapi/__tests__/*.e2e.spec.js
```
