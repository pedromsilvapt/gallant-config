import {
    // Schema Utilities
    Schema,
    SchemaKind,
    SchemaUtils,
    InnerSchema,

    // Value utilities
    ValueType,
    ValueTypeLike,
    ValueUtils,

    // Schema Types
    ObjectSchema,
    ChildrenSchema,
    PropertySchema,
    ValuesSchema,
    TagSchema,
    NodeSchema,
    DeferredSchema,
    DynamicSchema,
    SchemaTagsFactory,
} from './Schema';
import * as assert from 'assert';

// Decorators
export type PropertyDecorator = {
    [InnerSchema]: Schema;

    (target: Object, propertyKey: string): void;
}

function propertyDecorator(childSchema: Schema): PropertyDecorator {
    const fn: any = (target: Object, propertyKey: string) => {
        const schema = getObjectSchema(target);

        let existingSchema = schema.properties[propertyKey];

        schema.properties[propertyKey] = childSchema;

        // This is meant to allow decorators @Optional() and @Default() to appear after the @Property/@Value/@Child ones
        // If we did not check this, their values would simply be overriden
        if (existingSchema != null) {
            if ((SchemaUtils.isKind(childSchema, 'children') && SchemaUtils.isKind(existingSchema, 'children'))
             || (SchemaUtils.isKind(childSchema, 'values') && SchemaUtils.isKind(existingSchema, 'values'))
             || (SchemaUtils.isKind(childSchema, 'property') && SchemaUtils.isKind(existingSchema, 'property'))) {
                childSchema.optional = existingSchema.optional;
                childSchema.default = existingSchema.default;
            }
        }
    };

    fn[InnerSchema] = childSchema;

    return fn;
}

export interface ChildrenOptions {

}

export function Children (tagSchema: SchemaTagsFactory, type: any, options?: ChildOptions) : PropertyDecorator;
export function Children (tagSchema: string | symbol, type: any, options?: ChildrenOptions) : PropertyDecorator;
export function Children (tagSchema: Record<string | symbol, any>, options?: ChildrenOptions) : PropertyDecorator;
export function Children (arg0: string | symbol | Record<string | symbol, any> | SchemaTagsFactory, arg1?: any | ChildrenOptions, arg2?: ChildrenOptions) : PropertyDecorator {
    let tagSchemas: SchemaTagsFactory;

    if (typeof arg0 === 'string' || typeof arg0 === 'symbol') {
        tagSchemas = () => ({ [arg0]: SchemaUtils.schemaOf(arg1) });
    } else if (typeof arg0 === 'function') {
        tagSchemas = arg0 as SchemaTagsFactory;
    } else {
        const tagSchemasObject: Record<string | symbol, Schema> = {};

        for (const key of [...Object.getOwnPropertyNames(arg0), ...Object.getOwnPropertySymbols(arg0)]) {
            let propertySchema = arg0[key];

            tagSchemasObject[key] = SchemaUtils.schemaOf(propertySchema);
        }

        tagSchemas = () => tagSchemasObject;
    }

    // If the first argument is a string, then the options are in position 2 (starting from 0)
    // Otherwise they are in position 1
    const options: ChildrenOptions = typeof arg0 === 'string'
        ? arg2
        : arg1;

    const childrenSchema: ChildrenSchema = {
        [SchemaKind]: 'children',
        default: false,
        optional: true,
        single: false,
        tagSchemas: tagSchemas,
    };

    return propertyDecorator(childrenSchema);
}

export interface ChildOptions {

}

export function Child (tagSchema: SchemaTagsFactory, type: any, options?: ChildOptions) : PropertyDecorator;
export function Child (tagSchema: string | symbol, type: any, options?: ChildOptions) : PropertyDecorator;
export function Child (tagSchema: Record<string | symbol, any>, options?: ChildOptions) : PropertyDecorator;
export function Child (arg0: string | symbol | Record<string | symbol, any> | SchemaTagsFactory, arg1?: any | ChildOptions, arg2?: ChildOptions) : PropertyDecorator {
    let tagSchemas: SchemaTagsFactory;

    if (typeof arg0 === 'string' || typeof arg0 === 'symbol') {
        tagSchemas = () => ({ [arg0]: SchemaUtils.schemaOf(arg1) });
    } else if (typeof arg0 === 'function') {
        tagSchemas = arg0 as SchemaTagsFactory;
    } else {
        const tagSchemasObject: Record<string | symbol, Schema> = {};

        for (const key of [...Object.getOwnPropertyNames(arg0), ...Object.getOwnPropertySymbols(arg0)]) {
            let propertySchema = arg0[key];

            tagSchemasObject[key] = SchemaUtils.schemaOf(propertySchema);
        }

        tagSchemas = () => tagSchemasObject;
    }

    // If the first argument is a string, then the options are in position 2 (starting from 0)
    // Otherwise they are in position 1
    const options: ChildrenOptions = typeof arg0 === 'string' || typeof arg0 === 'symbol'
        ? arg2
        : arg1;

    const childSchema: ChildrenSchema = {
        [SchemaKind]: 'children',
        default: false,
        optional: false,
        single: true,
        tagSchemas: tagSchemas,
    };

    return propertyDecorator(childSchema);
}

export interface PropertyOptions {

}

export function Property (name: string, type: ValueTypeLike | ValueTypeLike[], options?: PropertyOptions) {
    const propertySchema: PropertySchema = {
        [SchemaKind]: 'property',
        optional: false,
        default: false,
        name: name,
        types:  type
            ? ValueUtils.valueOf(type, true)
            : [ValueType.String, ValueType.Number, ValueType.Boolean, ValueType.Null]
    };

    return propertyDecorator(propertySchema);
}

export interface ValuesOptions {
}

export function Values (start: number = 0, type: ValueTypeLike | ValueTypeLike[], options?: ValuesOptions) {
    const valuesSchema: ValuesSchema = {
        [SchemaKind]: 'values',
        default: false,
        optional: false,
        single: false,
        start: start,
        length: Infinity,
        types:  type
            ? ValueUtils.valueOf(type, true)
            : [ValueType.String, ValueType.Number, ValueType.Boolean, ValueType.Null]
    };

    return propertyDecorator(valuesSchema);
}

export interface ValueOptions {
}

export function Value (index: number = 0, type: ValueTypeLike | ValueTypeLike[], options?: ValueOptions) {
    const valuesSchema: ValuesSchema = {
        [SchemaKind]: 'values',
        default: false,
        optional: false,
        single: true,
        start: index,
        length: 1,
        types: type
            ? ValueUtils.valueOf(type, true)
            : [ValueType.String, ValueType.Number, ValueType.Boolean, ValueType.Null]
    };

    return propertyDecorator(valuesSchema);
}

export function Optional () {
    return (target: Object, propertyKey: string) => {
        const schema = getObjectSchema(target);

        const propertySchema = schema.properties[propertyKey];

        if (SchemaUtils.isKind(propertySchema, 'children')
         || SchemaUtils.isKind(propertySchema, 'values')
         || SchemaUtils.isKind(propertySchema, 'property')) {
            propertySchema.optional = true;
        }
    };
}

export function Default () {
    return (target: Object, propertyKey: string) => {
        const schema = getObjectSchema(target);

        const propertySchema = schema.properties[propertyKey];

        if (SchemaUtils.isKind(propertySchema, 'children')
         || SchemaUtils.isKind(propertySchema, 'values')
         || SchemaUtils.isKind(propertySchema, 'property')) {
            propertySchema.default = true;
        }
    };
}

export function Tag () {
    const rawSchema: TagSchema = {
        [SchemaKind]: 'tag',
    };

    return propertyDecorator(rawSchema);
}

export function Node () {
    const rawSchema: NodeSchema = {
        [SchemaKind]: 'node',
    };

    return propertyDecorator(rawSchema);
}

function getObjectSchema (target: any): ObjectSchema {
    if (!(InnerSchema in target)) {
        target[InnerSchema] = <ObjectSchema>{
            [SchemaKind]: 'object',
            classConstructor: target.constructor,
            properties: {}
        };
    }

    const schema = target[InnerSchema];

    assert(SchemaUtils.isKind(schema, "object"));

    return schema as ObjectSchema;
}
