# Config

> Config module with optional type validation and multiple optional override files

# Installation
```shell
npm install --save @pedromsilva/data-config
```

# Usage
```typescript
import { Config } from '@pedromsilva/data-config';

// Can either be a folder or a file name
const config = Config.load( 'config' );

// Can also use the async variant
const configAsync = Config.loadAsync( 'config' );

// Multiple configurations can also be deep merged manually
const fullConfig = Config.merge( [ config, configAsync ] );

// Getting values can be done through the .get method, with an optional default value
const value = fullConfig.get<OptionalType>( 'key.value', 'optional default value' );
```

By default the app uses the JSON loader. If your config files use another format, you can provide it a custom loader. For example, using the `json5` module:

```typescript
import { Config } from '@pedromsilva/data-config';
import JSON5 from 'json5';

const config = Config.load( 'config', [ new class {
    accepts = ( name : string ) => /json(5)?/i.test(name);

    parse = JSON5.parse
} ] );
```