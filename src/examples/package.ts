import { Config } from '../Config';
import { KDLFormat } from '../Formats';
import {
    Tag, Any, Child, Children, Property, Value, Optional, Default, SchemaUtils
} from '../kdl';

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

const format = new KDLFormat(SchemaUtils.schemaOf(Child('package', Package)));

const config: Config<Package> = Config.load(process.cwd() + '/src/examples/package.kdl', format);

console.log(JSON.stringify(config.data, null, 4));

