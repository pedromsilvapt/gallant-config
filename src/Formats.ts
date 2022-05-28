import * as yaml from 'js-yaml';
import { parse as parseKDL } from 'kdljs';
import { ConfigNode, Deserializer, Schema } from './kdl';

export interface ConfigFormat {
    accepts ? ( format : string ) : boolean;

    parse ( content : string ) : any;
}

export class JSONFormat implements ConfigFormat {
    public accepts ( format : string ) : boolean {
        return /json/i.test( format );
    }

    public parse ( content : string ) : any {
        return JSON.parse( content );
    }
}

export class YAMLFormat implements ConfigFormat {
    public accepts ( format : string ) : boolean {
        return /(yaml|yml)/i.test( format );
    }

    public parse ( content : string ) : any {
        return yaml.load( content );
    }
}

export class KDLFormat implements ConfigFormat {
    public readonly schema : Schema;

    public readonly deserializer : Deserializer;

    public constructor ( schema : Schema, context?: any ) {
        this.schema = schema;
        this.deserializer = new Deserializer(context);
    }

    public accepts ( format : string ) : boolean {
        return /kdl/i.test( format );
    }

    public parse ( content : string ) : any {
        const nodes = parseKDL( content );

        const root = {
            name: '',
            children: nodes.output,
            properties: {},
            values: [],
            tags: {
                name: void 0,
                properties: {},
                values: []
            }
        } as ConfigNode;

        return this.deserializer.deserialize(root, this.schema);
    }
}
