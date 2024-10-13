import { ConfigNode, ConfigValue, NodesReader } from './Core';
import {
    // Symbols
    InnerSchema,
    SchemaKind,

    Schema,
    ChildrenSchema,
    PropertySchema,
    DeferredSchema,
    DynamicSchema,
    ValuesSchema,
    ObjectSchema,

    SchemaUtils,
    ValueUtils,
    NodeSchema,
    TagSchema,
    Any,
} from './Schema';

interface ChildConfigNode {
    schema: Schema;
    node: ConfigNode;
}

export class Deserializer<C = any> {
    public context: C;

    public constructor (context?: C) {
        this.context = context;
    }

    public deserialize (node: ConfigNode, schema: Schema, reader?: NodesReader, defaultValue: unknown = null): unknown {
        // If the user did not pass a reader, we should throw an Error when the deserialization failed
        const shouldThrow = reader == null;

        reader = reader ?? new NodesReader();

        let value: unknown;

        try {
            if (SchemaUtils.isKind(schema, 'object')) {
                value = this.deserializeObjectSchema(node, schema, reader, defaultValue);
            } else if (SchemaUtils.isKind(schema, 'children')) {
                value = this.deserializeChildrenSchema(node, schema, reader, defaultValue);
            } else if (SchemaUtils.isKind(schema, 'property')) {
                value = this.deserializePropertySchema(node, schema, reader, defaultValue);
            } else if (SchemaUtils.isKind(schema, 'values')) {
                value = this.deserializeValuesSchema(node, schema, reader, defaultValue);
            } else if (SchemaUtils.isKind(schema, 'tag')) {
                value = this.deserializeTagSchema(node, schema, reader, defaultValue);
            } else if (SchemaUtils.isKind(schema, 'node')) {
                value = this.deserializeNodeSchema(node, schema, reader, defaultValue);
            } else if (SchemaUtils.isKind(schema, 'deferred')) {
                value = this.deserializeDeferredSchema(node, schema, reader, defaultValue);
            } else if (SchemaUtils.isKind(schema, 'dynamic')) {
                value = this.deserializeDynamicSchema(node, schema, reader, defaultValue);
            } else {
                reader.addError(`Invalid schema kind ${(schema as any)[SchemaKind]}`);
            }
        } catch ( error ) {
            reader.addError( error.message + '\n' + error.stackTrace );
        }

        // Since this function is recursively called but always with a reader passed as argument,
        // in such instances it will not throw, meaning it will only throw at most once: at the end of the deserialization,
        // when the call stack has unrolled completely and this is the last stack frame
        if (shouldThrow) {
            reader.throwIfFailed();
        }

        return value;
    }

    public deserializeDeferredSchema (node: ConfigNode, schema: DeferredSchema, reader: NodesReader, defaultValue: unknown) {
        const childSchema = schema.proxy[InnerSchema];

        if (childSchema != null) {
            return this.deserialize(node, childSchema, reader, defaultValue);
        } else {
            return null;
        }
    }

    public deserializeDynamicSchema (node: ConfigNode, schema: DynamicSchema, reader: NodesReader, defaultValue: unknown) {
        return this.deserialize(node, schema.factory(node, this.context), reader, defaultValue);
    }

    public deserializeObjectSchema (node: ConfigNode, schema: ObjectSchema, reader: NodesReader, defaultValue: unknown) {
        let object: any = null;

        if (schema.classConstructor) {
            object = new schema.classConstructor();
        } else {
            object = {};
        }

        for (const property of Object.keys(schema.properties)) {
            object[property] = this.deserialize(node, schema.properties[property], reader, object[property]);
        }

        return object;
    }

    public deserializeChildrenSchema (node: ConfigNode, schema: ChildrenSchema, reader: NodesReader, defaultValue: unknown): unknown {
        let result: ChildConfigNode[] | ChildConfigNode | null = null;

        if (schema.single === false) {
            result = [];
        }

        let exitChildrenLoop = false;

        for (const child of node.children) {
            let childSchema = null;

            if (child.name in schema.tagSchemas) {
                childSchema = schema.tagSchemas[child.name];
            } else if (Any in schema.tagSchemas) {
                childSchema = schema.tagSchemas[Any];
            }

            if (childSchema != null) {
                if (result instanceof Array) {
                    result.push({
                        schema: childSchema,
                        node: child,
                    });
                } else {
                    result = {
                        schema: childSchema,
                        node: child,
                    };

                    // If we only want the first child, then we can break the loop on the first match
                    exitChildrenLoop = true;
                }
            } else {
                // We cannot throw the error here because this method may only be looking for a subset of tags
                // reader.addError(`No schema for tag named ${child.name}`);
            }

            if (exitChildrenLoop) {
                break;
            }
        }

        if (result instanceof Array) {
            // In case schema.single == false
            if (result.length === 0) {
                if (schema.default === false && schema.optional === false) {
                    const expectedTags = Object.keys(schema.tagSchemas).join(', ');

                    reader.addError(`Expected one or more of the following child tags, found none: ${expectedTags}`);
                } else {
                    return defaultValue;
                }
            }

            return result.map(child => {
                reader.beginChild(child.node.name);

                const deserialized = this.deserialize(child.node, child.schema, reader);

                reader.endChild(child.node);

                return deserialized;
            });
        } else {
            if (result === null) {
                if (schema.default === false && schema.optional === false) {
                    const expectedTags = Object.keys(schema.tagSchemas).join(', ');

                    reader.addError(`Expected one of the following child tags, found none: ${expectedTags}`);

                    return defaultValue;
                } else if (schema.default === true) {
                    result = {
                        node: {
                            name: '',
                            children: [],
                            properties: {},
                            values: [],
                            tags: {
                                name: void 0,
                                properties: {},
                                values: []
                            }
                        },
                        schema: schema.tagSchemas[Object.keys(schema.tagSchemas)[0]]
                    };
                } else {
                    // Then schema.optional must be true
                    return defaultValue;
                }
            }

            // In case schema.single == true
            reader.beginChild(result.node.name);

            const deserialized = this.deserialize(result.node, result.schema, reader);

            reader.endChild(result.node);

            return deserialized;
        }
    }

    public deserializePropertySchema (node: ConfigNode, schema: PropertySchema, reader: NodesReader, defaultValue: unknown): ConfigValue {
        if (schema.name in node.properties) {
            reader.beginProperty(schema.name);

            const value = node.properties[schema.name];

            const typeError = ValueUtils.validate(value, schema.types);

            if (typeError != null) {
                reader.addError(`Expected type ${typeError.expected}, got ${typeError.actual} instead`);
            }

            reader.endProperty();

            return value;
        }

        if (schema.optional) {
            return defaultValue as ConfigValue;
        }

        if (schema.default) {
            return ValueUtils.default(schema.types);
        }

        reader.beginProperty(schema.name);
        reader.addError(`Mandatory property missing`);
        reader.endProperty();
    }

    public deserializeTagSchema (node: ConfigNode, schema: TagSchema, reader: NodesReader, defaultValue: unknown) {
        return node.name;
    }

    public deserializeNodeSchema (node: ConfigNode, schema: NodeSchema, reader: NodesReader, defaultValue: unknown) {
        return node;
    }

    public deserializeValuesSchema (node: ConfigNode, schema: ValuesSchema, reader: NodesReader, defaultValue: unknown) {
        if (schema.start < node.values.length &&
           (schema.single || schema.length === null || schema.length === Infinity || schema.start + schema.length <= node.values.length)) {
            if (schema.single === true) {
                reader.beginValue(true, schema.start);

                const typeError = ValueUtils.validate(node.values[schema.start], schema.types);

                if (typeError != null) {
                    reader.addError(`Expected type ${typeError.expected}, got ${typeError.actual} instead`);
                }

                reader.endValue();

                return node.values[schema.start];
            }

            let slice = (schema.length == null || schema.length === Infinity)
                ? node.values.slice(schema.start)
                : node.values.slice(schema.start, schema.start + schema.length);

            for (const [index, value] of slice.entries()) {
                reader.beginValue(true, schema.start + index);

                const typeError = ValueUtils.validate(value, schema.types);

                if (typeError != null) {
                    throw new Error(`Expected type ${typeError.expected}, got ${typeError.actual} instead`);
                }

                reader.endValue();
            }

            return slice;
        }

        if (schema.optional) {
            return defaultValue;
        }

        if (schema.default) {
            if (schema.single) {
                return ValueUtils.default(schema.types);
            } else {
                return [];
            }
        }

        reader.beginValue(schema.single, schema.start, schema.length);
        reader.addError(`Mandatory value(s) missing`);
        reader.endValue();
    }
}
