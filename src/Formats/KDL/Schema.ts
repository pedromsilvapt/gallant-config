import { ConfigNode, ConfigValue } from './Core';

interface Class<T> {
    new(): T;
}


export const InnerSchema: unique symbol = Symbol('InnerSchema');

export const SchemaKind: unique symbol = Symbol('SchemaKind');

export const Any: unique symbol = Symbol('Any');

export type Schema = ObjectSchema | ChildrenSchema | ValuesSchema | PropertySchema | TagSchema | NodeSchema | DeferredSchema | DynamicSchema;

export type SchemaKindMap<K extends string> =
    K extends 'object'
    ? ObjectSchema
    : K extends 'children'
    ? ChildrenSchema
    : K extends 'values'
    ? ValuesSchema
    : K extends 'property'
    ? PropertySchema
    : K extends 'tag'
    ? TagSchema
    : K extends 'node'
    ? NodeSchema
    : K extends 'deferred'
    ? DeferredSchema
    : K extends 'dynamic'
    ? DynamicSchema
    : never;

export interface DynamicSchema {
    [SchemaKind]: 'dynamic';
    factory: (configNode: ConfigNode, context: any) => Schema;
}

export interface DeferredSchema {
    [SchemaKind]: 'deferred';
    proxy: {
        [InnerSchema]: Schema;
    };
}

export interface ObjectSchema {
    [SchemaKind]: 'object';
    classConstructor?: Class<unknown>;
    properties: Record<string, Schema>;
}

export interface ChildrenSchema {
    [SchemaKind]: 'children';
    tagSchemas: Record<string | symbol, Schema>;
    single: boolean;
    optional: boolean;
    default: boolean;
}

export interface ValuesSchema {
    [SchemaKind]: 'values';
    start: number;
    length: number | null;
    single: boolean;
    types: ValueType[];
    optional: boolean;
    default: boolean;
}

export interface PropertySchema {
    [SchemaKind]: 'property';
    name: string;
    types: ValueType[];
    optional: boolean;
    default: boolean;
}

export interface TagSchema {
    [SchemaKind]: 'tag';
}

export interface NodeSchema {
    [SchemaKind]: 'node';
}

export class SchemaUtils {
    public static isKind<K extends 'object' | 'children' | 'values' | 'property' | 'tag' | 'node' | 'deferred' | 'dynamic'> (
        schema: Schema, kind: K
    ): schema is SchemaKindMap<K> {
        return schema != null && schema[SchemaKind] === kind;
    }

    public static isSchema (object: any): object is Schema {
        return object != null && SchemaKind in object;
    }

    public static schemaOf (object: any): Schema {
        if (InnerSchema in object && this.isSchema(object[InnerSchema])) {
            return object[InnerSchema];
        }

        if (this.isSchema(object)) {
            return object;
        }

        if (object === Number || object === String || object === Boolean) {
            return <ValuesSchema>{
                [SchemaKind]: 'values',
                default: false,
                length: 1,
                optional: true,
                single: true,
                start: 0,
                types: [ValueUtils.valueOf(object)]
            };
        }

        return {
            [SchemaKind]: 'deferred',
            proxy: new object
        } as DeferredSchema;
    }

    public static dynamic (factory: (node: ConfigNode, context: any) => Schema): DynamicSchema {
        return {
            [SchemaKind]: 'dynamic',
            factory
        };
    }
}

export enum ValueType {
    String,
    Number,
    Boolean,
    Null,
}

export type ValueTypeLike = ValueType | 'string' | 'number' | 'boolean' | 'null' | typeof String | typeof Number | typeof Boolean;

export class ValueUtils {
    public static valueOf (valueType: ValueTypeLike): ValueType;
    public static valueOf (valueType: ValueTypeLike[]): ValueType[];
    public static valueOf (valueType: ValueTypeLike | ValueTypeLike[], asArray: true): ValueType[];
    public static valueOf (valueType: ValueTypeLike | ValueTypeLike[]): ValueType | ValueType[];
    public static valueOf (valueType: ValueTypeLike | ValueTypeLike[], asArray: boolean = false): ValueType | ValueType[] {
        if (valueType instanceof Array) {
            return valueType.map(value => this.valueOf(value));
        } else {
            if (asArray) {
                return [this.valueOf(valueType)];
            }

            if (valueType === 'string' || valueType === String) {
                return ValueType.String;
            } else if (valueType === 'boolean' || valueType === Boolean) {
                return ValueType.Boolean;
            } else if (valueType === 'number' || valueType === Number) {
                return ValueType.Number;
            } else if (valueType === 'null') {
                return ValueType.Null;
            } else {
                return valueType as ValueType;
            }
        }
    }

    public static validate (value: ConfigValue, types: ValueType[]) {
        let unexpected: ValueType | null = null;

        if (value === null || value === void 0 && !types.includes(ValueType.Null)) {
            unexpected = ValueType.Null;
        }

        if (typeof value === 'string' && !types.includes(ValueType.String)) {
            unexpected = ValueType.String;
        }

        if (typeof value === 'number' && !types.includes(ValueType.Number)) {
            unexpected = ValueType.Number;
        }

        if (typeof value === 'boolean' && !types.includes(ValueType.Boolean)) {
            unexpected = ValueType.Boolean;
        }

        if (unexpected != null) {
            const expected = types.map(t => ValueType[t]).join(', ');

            return { expected, actual: ValueType[unexpected] };
        }

        return null;
    }

    public static default (types: ValueType[]): ConfigValue {
        if (types.includes(ValueType.Null) || types.includes(ValueType.String)) {
            return null;
        } else if (types.includes(ValueType.Number)) {
            return 0;
        } else if (types.includes(ValueType.Boolean)) {
            return false;
        } else {
            throw new Error(`Invalid types, cannot produce default.`);
        }
    }

}
