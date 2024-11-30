import { Config } from '../Config';
import { KDLFormat } from '../Formats';
import {
    Child, Children,
    Property,
    Value, Values,
    Optional, Default,
    SchemaUtils
} from '../kdl';

export class Server {
    @Optional() @Child('port', Number)
    port: number | null = null;
}

export class Allow {
    @Values(0, String)
    values: string[] = [];
}

export class Deny {
    @Values(0, String)
    values: string[] = [];
}

export class RolePath {
    @Value(0, String)
    path!: string;

    @Children({ 'allow': Allow, 'deny': Deny, 'path': RolePath })
    permissions: (Allow | Deny | RolePath)[] = [];
}

export class User {
    @Value(0, String)
    user!: string;

    @Value(1, String)
    password!: string;
}

export class Role {
    @Children('user', User)
    users: User[] = [];

    @Children({ 'allow': Allow, 'deny': Deny, 'path': RolePath })
    permissions: (Allow | Deny | RolePath)[] = [];
}

export const FileSystemFactory = SchemaUtils.dynamic(configNode => {
    return SchemaUtils.schemaOf(PhysicalFileSystem);
});

export class FileSystem { };

export class Mount {
    @Child('fs', FileSystemFactory)
    fileSystem!: FileSystem;
}

export class Remote {
    @Value(0, String)
    name!: string;

    @Property('address', String)
    address!: string;

    @Property('port', Number)
    port!: number;
}

export class ShareDavConfig {
    @Children('role', Role)
    roles: Role[] = [];

    @Children('mount', Mount)
    mount: Mount[] = [];

    @Children('remote', Remote)
    remote: Remote[] = [];

    @Default() @Child('server', Server)
    server!: Server;
}

export class PhysicalFileSystem extends FileSystem {
    @Property('path', String)
    path!: string;

    @Optional() @Children('ignore', String)
    ignore: string[] = ['thumbs.db'];
}

const format = new KDLFormat(SchemaUtils.schemaOf(ShareDavConfig));

const config: Config<ShareDavConfig> = Config.load(process.cwd() + '/src/examples/sharedav.kdl', format);

console.log(JSON.stringify(config.data, null, 4));
