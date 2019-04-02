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

### Linter

Use `cf-openapi` command line interface for validating `openapi.json`:

`cf-openapi lint` - lint using default path `./openapi.json` (relative to `process.cwd()`)

`cf-openapi lint ./some/path/openapi-custom-name.json` - lint using given path

`cf-openapi lint -p` - lint post-processed `openapi.json` (see: `./lib/components/Processor.component.js`)


Use npm script:

```json
{
  "scripts": {
    "openapi-lint": "cf-openapi lint && cf-openapi lint -p"
  }
}
```

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


