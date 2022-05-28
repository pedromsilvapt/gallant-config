# Config

> Simple TypeScript/ES2017 class to load configuration files from a folder

# Installation
```shell
npm install --save @gallant/config
```

# Usage
```typescript
import { Config } from '@gallant/config';

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
import { Config } from '@gallant/config';
import JSON5 from 'json5';

const config = Config.load( 'config', [ new class {
    accepts = ( name : string ) => /json(5)?/i.test(name);

    parse = JSON5.parse
} ] );
```

## KDL

[KDL](https://kdl.dev/) is a document language with xml-like semantics, but a lighter syntax.

We also support loading KDL files out of the box, but those require a litle a schema to be defined, so that the file can be properly translated to an object in memory.

```kdl
package {
    name "foo"
    version "1.0.0"
    dependencies platform="windows" {
        winapi "1.0.0" path="./crates/my-winapi-fork"
    }
    dependencies {
        miette "2.0.0" dev=true
    }
}
```

```typescript
import { Config, SchemaUtils, KDLFormat } from '@gallant/config';
import {
    Tag, Any, Child, Children, Property, Value, Optional, Default
} from '@gallant/config/kdl';

export class PackageDependency {
    @Tag()
    name: string; // winapi, miette

    @Value(0, String)
    version: string; // 1.0.0, 2.0.0
    
    @Optional() @Property('dev', Boolean)
    dev?: boolean; // null, true

    @Optional() @Property('path', String)
    path?: string; // null, ./crates/my-winapi-fork
}

export class DependenciesGroup {
    @Optional() @Property('platform', String)
    platform?: string;

    @Default() @Children(Any, PackageDependency)
    packageDependencies: PackageDependency[] = [];
}

export class Package {
    @Child('name', String)
    name!: string;

    @Child('version', String)
    version!: string;

    @Default() @Children('dependencies', DependenciesGroup)
    dependencies!: DependenciesGroup[];
}

const format = new KDLFormat(SchemaUtils.schemaOf(Child('package', Package));

const package: Package = Config.load('package.kdl', format);
```

The resulting object from this will be:
```json
{
  "name": "foo",
  "version": "1.0.0",
  "dependencies": [
    {
      "packageDependencies": [
        {
          "name": "winapi",
          "version": "1.0.0",
          "dev": false,
          "path": "./crates/my-winapi-fork"
        }
      ],
      "platform": "windows"
    },
    {
      "packageDependencies": [
        {
          "name": "miette",
          "version": "2.0.0",
          "dev": true,
          "path": null
        }
      ],
      "platform": null
    }
  ]
}
```