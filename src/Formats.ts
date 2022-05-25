import * as yaml from 'js-yaml';

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
