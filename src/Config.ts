import * as path from 'path';
import * as fs from 'mz/fs';
import * as ObjectPath from 'object-path';
import * as extend from 'extend';
import * as os from 'os';
import { ConfigFormat, JSONFormat, YAMLFormat } from './Formats';
import { Type } from '@gallant/schema';

function formatAccepts ( format : ConfigFormat, formatName : string ) : boolean {
    if ( format.accepts != null ) {
        return format.accepts( formatName );
    } else {
        return true;
    }
}

function loadFile ( file : string, formats : ConfigFormat[] ) : any {
    if ( fs.existsSync( file ) ) {        
        const content = fs.readFileSync( file, { encoding: 'utf8' } );

        const formatName = path.extname( file ).slice(1);

        const format = formats.find( format => formatAccepts( format, formatName ) );

        if ( format == null ) {
            throw new Error( `Could not find a Config Format for file ${ file }.` );
        }

        return format.parse( content );
    }

    return {};
}

async function loadFileAsync ( file : string, formats : ConfigFormat[] ) : Promise<any> {
    if ( await fs.exists( file ) ) {
        const content = await fs.readFile( file, { encoding: 'utf8' } );

        const formatName = path.extname( file ).slice(1);

        const format = formats.find( format => formatAccepts( format, formatName ) );

        if ( format == null ) {
            throw new Error( `Could not find a Config Format for file ${ file }.` );
        }

        return format.parse( content );
    }

    return {};
}

export interface ConfigContext {
    instance: string;
    short_hostname: string;
    full_hostname: string;
    deployment: string;
    platform: string;
}

export class Config<T extends object = any> {
    protected static instance : Config;

    public static formats : ConfigFormat[] = [
        new JSONFormat(),
        new YAMLFormat(),
    ];

    static singleton () : Config {
        if ( !this.instance ) {
            this.instance = Config.load( path.join( process.cwd(), 'config' ) );
        }

        return this.instance;
    }

    static has ( path : string ) : boolean {
        return this.singleton().has( path );
    }

    static get<T = any> ( path : string, defaultValue ?: T ) : T {
        return this.singleton().get<T>( path, defaultValue );
    }

    static getContext () : ConfigContext {
        const env = process.env;
        const hostname = env.HOST || env.HOSTNAME || os.hostname();
        const platform = os.platform();

        return {
            instance: env.NODE_APP_INSTANCE,
            short_hostname: hostname.split( '.' )[ 0 ],
            full_hostname: hostname,
            deployment: env.NODE_ENV || 'development',
            platform: platform
        };
    }

    static getFileNames () : string[] {
        const context = Config.getContext();

        const check = ( strings : TemplateStringsArray, ...values : string[] ) : string => {
            if ( values.some( v => !v ) ) {
                return null;
            }

            return strings.map( ( s, i ) => i == 0 ? s : `${ values[ i - 1 ] }${ s }` ).join( '' );
        };

        return [
            check`default`,
            check`default-${context.platform}`,
            check`default-${context.instance}`,
            check`default-${context.instance}-${context.platform}`,
            check`default-${context.deployment}`,
            check`default-${context.deployment}-${context.platform}`,
            check`default-${context.deployment}-${context.instance}`,
            check`default-${context.deployment}-${context.instance}-${context.platform}`,
            check`${context.short_hostname}`,
            check`${context.short_hostname}-${context.platform}`,
            check`${context.short_hostname}-${context.instance}`,
            check`${context.short_hostname}-${context.instance}-${context.platform}`,
            check`${context.short_hostname}-${context.deployment}`,
            check`${context.short_hostname}-${context.deployment}-${context.platform}`,
            check`${context.short_hostname}-${context.deployment}-${context.instance}`,
            check`${context.short_hostname}-${context.deployment}-${context.instance}-${context.platform}`,
            check`${context.full_hostname}`,
            check`${context.full_hostname}-${context.platform}`,
            check`${context.full_hostname}-${context.instance}`,
            check`${context.full_hostname}-${context.instance}-${context.platform}`,
            check`${context.full_hostname}-${context.deployment}`,
            check`${context.full_hostname}-${context.deployment}-${context.platform}`,
            check`${context.full_hostname}-${context.deployment}-${context.instance}`,
            check`${context.full_hostname}-${context.deployment}-${context.instance}-${context.platform}`,
            check`local`,
            check`local-${context.platform}`,
            check`local-${context.instance}`,
            check`local-${context.instance}-${context.platform}`,
            check`local-${context.deployment}`,
            check`local-${context.deployment}-${context.platform}`,
            check`local-${context.deployment}-${context.instance}`,
            check`local-${context.deployment}-${context.instance}-${context.platform}`
        ].filter( name => name );
    }

    static async getFilesAsync ( folder : string, formats : ConfigFormat[] = Config.formats ) : Promise<string[]> {
        var stat = await fs.stat( folder );

        if ( stat.isFile() ) {
            return [ '' ];
        }

        const allFiles = await fs.readdir( folder );

        const allFilesByBasename = new Map<string, string[]>();

        for ( const fileName of allFiles ) {
            const formatName = path.extname( fileName ).slice( 1 );

            if ( !formats.some( format => formatAccepts( format, formatName ) ) ) {
                continue;
            }

            const basename = path.basename( fileName, path.extname( fileName ) );

            if ( allFilesByBasename.has( basename ) ) {
                allFilesByBasename.get( basename ).push( fileName );
            } else {
                allFilesByBasename.set( basename, [ fileName ] );
            }
        }

        const filesNamesToLoad : string[] = [];

        for ( let name of this.getFileNames() ) {
            if ( allFilesByBasename.has( name ) ) {
                filesNamesToLoad.push( ...allFilesByBasename.get( name ) );
            }
        }
        
        return filesNamesToLoad;
    }

    static getFiles ( folder : string, formats : ConfigFormat[] = Config.formats ) : string[] {
        var stat = fs.statSync( folder );

        if ( stat.isFile() ) {
            return [ '' ];
        }

        const allFiles = fs.readdirSync( folder );

        const allFilesByBasename = new Map<string, string[]>();

        for ( const fileName of allFiles ) {
            const formatName = path.extname( fileName ).slice( 1 );

            if ( !formats.some( format => formatAccepts( format, formatName ) ) ) {
                continue;
            }

            const basename = path.basename( fileName, path.extname( fileName ) );

            if ( allFilesByBasename.has( basename ) ) {
                allFilesByBasename.get( basename ).push( fileName );
            } else {
                allFilesByBasename.set( basename, [ fileName ] );
            }
        }

        const filesNamesToLoad : string[] = [];

        for ( let name of this.getFileNames() ) {
            if ( allFilesByBasename.has( name ) ) {
                filesNamesToLoad.push( ...allFilesByBasename.get( name ) );
            }
        }
        
        return filesNamesToLoad;
    }

    static async loadAsync ( folder : string, formats : ConfigFormat | ConfigFormat[] = Config.formats ) : Promise<Config> {
        if (!(formats instanceof Array)) {
            formats = formats != null ? [formats] : [];
        }

        let data = {};

        let files = await Config.getFilesAsync( folder, formats );

        for ( let file of files ) {
            const content = await loadFileAsync( path.join( folder, file ), formats );

            data = extend( true, data, content );
        }

        return new Config( data );
    }

    static load ( folder : string, formats : ConfigFormat | ConfigFormat[] = Config.formats ) : Config {
        if (!(formats instanceof Array)) {
            formats = formats != null ? [formats] : [];
        }

        let data = {};

        let files = Config.getFiles( folder, formats );

        for ( let file of files ) {
            const content = loadFile( path.join( folder, file ), formats );

            data = extend( true, data, content );
        }

        return new Config( data );
    }

    static create ( data : any ) : Config {
        return new Config( data );
    }

    static merge ( configs : Config[] ) : Config {
        if ( configs.length == 1 ) {
            return configs[ 0 ];
        }

        let data = {};

        for ( let config of configs ) {
            data = extend( true, data, config.data );
        }
        
        return new Config( data );
    }

    data : T;

    constructor ( data : any ) {
        this.data = data;
    }

    has ( path : string ) : boolean {
        return ObjectPath.has( this.data, path );
    }

    get<T = any> ( path : string, defaultValue ?: T ) : T {
        return ObjectPath.get( this.data, path, defaultValue );
    }
    
    slice ( path : string ) : Config {
        return Config.create( this.get( path, {} ) );
    }

    clone () : Config {
        const data = JSON.parse( JSON.stringify( this.data ) );

        return Config.create( data );
    }
}

export interface ConfigInstanceOptions {
    key ?: string;
    list ?: string;
    defaults ?: any[];
}

export class ConfigInstances {
    static get ( key : string, type : string, options : ConfigInstanceOptions = {} ) {
        return new ConfigInstances( Config.singleton() ).get( key, type, options );
    }

    config : Config;

    constructor ( config : Config ) {
        this.config = config;
    }

    get ( key : string, type : string, options : ConfigInstanceOptions = {} ) {
        const bag = this.config.get( key ) || [];

        let list : any[];

        if ( !( bag instanceof Array ) ) {
            list = bag[ options.list || 'list' ];

            if ( !list ) {
                list = [];
            }
        } else {
            list = bag || [];
        }

        const instances = list.filter( instance => instance[ options.key || 'type' ] == type );

        if ( instances.length === 0 && bag && !( bag instanceof Array ) ) {
            const defaults = options.defaults;

            let allowDefaults = true;

            if ( typeof( bag.defaults ) === 'boolean' ) {
                allowDefaults = false;
            } else if ( bag.defaults ) {
                allowDefaults = !( type in bag.defaults ) || bag.defaults[ type ];
            }

            if ( allowDefaults ) {
                return defaults || [];
            }

            return [];
        }

        return instances;
    }
}

export class ConfigTemplate {
    schema : Type;
}

/* DYNAMIC CONFIG */
export type DynamicConfig<T> = {
    [P in keyof T]: T[P] | ((options : T) => T[P]);
}

export function createLazyProperties<T extends object> ( dynamic : DynamicConfig<T> ) : T {
    const lazy = {} as T;

    for ( let key of Object.keys( dynamic ) ) {
        
        if ( ( dynamic as any )[ key ] instanceof Function ) {
            let state = {
                called: false,
                value: void 0 as any
            };

            Object.defineProperty( lazy, key, {
                enumerable: true,
                get () {
                    if ( !state.called ) {
                        state.called = true;

                        return state.value = ( dynamic as any )[ key ]( lazy );
                    }

                    return state.value;
                }
            } );
        } else {
            ( lazy as any )[ key ] = ( dynamic as any )[ key ];
        }
    }

    return lazy;
}

export function evaluate<T extends object> ( base : DynamicConfig<T>, ...extensions : DynamicConfig<Partial<T>>[] ) : T {
    const dynamicResult = {} as DynamicConfig<T>;

    for ( let extension of [ base, ...extensions ] ) {
        for ( let key of Object.keys( extension ) ) {
            ( dynamicResult as any )[ key ] = ( extension as any )[ key ];
        }
    }

    return { ...createLazyProperties( dynamicResult ) as any };
}
