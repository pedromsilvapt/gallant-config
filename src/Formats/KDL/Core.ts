import { kdljs } from 'kdljs';
import * as chalk from 'chalk';

export type ConfigNode = kdljs.Node;

export type ConfigValue = kdljs.Value;

export interface NodesReaderDeserializationError {
    selector: string;
    message: string;
}

export class NodesReader {
    public errors: NodesReaderDeserializationError[] = [];

    protected children: NodesReaderChild[] = [new NodesReaderChild("top()")];

    protected attribute: string | null = null;

    protected valueSingle: boolean | null = null;

    protected valueStart: number | null = null;

    protected valueEnd: number | null = null;

    protected get currentChild () : NodesReaderChild {
        return this.children[this.children.length - 1];
    }

    public beginChild (tagName: string): void {
        const index = this.currentChild.allocateIndex(tagName);

        this.children.push(new NodesReaderChild(tagName, index));
    }

    public endChild (node?: ConfigNode) {
        if (node?.children != null) {
            for (const child of node.children) {
                if (!this.currentChild.hasAllocated(child.name)) {
                    this.addError(`Unexpected child ${child.name}`);
                }
            }
        }

        this.children.pop();
    }

    public beginProperty (attribute: string) {
        this.valueStart = null;
        this.valueEnd = null;

        this.attribute = attribute;
    }

    public endProperty () {
        this.attribute = null;
    }

    public beginValue (single: boolean, start: number, length: number | null = null) {
        this.attribute = null;

        this.valueSingle = single;
        this.valueStart = start;
        this.valueEnd = (length != null && length != Infinity) ? (start + length) : null;
    }

    public endValue () {
        this.valueSingle = null;
        this.valueStart = null;
        this.valueEnd = null;
    }

    public addError (message: string) {
        const selector = this.getPath();

        this.errors.push({ selector, message });
    }

    public throwIfFailed () {
        if (this.errors.length) {
            throw new NodesReaderError(this);
        }
    }

    public get errorMessage() {
        if (this.errors.length > 0) {
            const errorsConcatenated = this.errors
                .map( message => `\t-${message.message}\n\t  ${message.selector}` )
                .join( '\n\n' );

            return `Deserialization failed with the following errors:\n${errorsConcatenated}`;
        }

        return null;
    }

    public get prettyErrorMessage() {
        if (this.errors.length > 0) {
            return this.errors
                .map( message => `${chalk.red('ERROR')} ${message.message}\n      in ${chalk.grey(message.selector)}` )
                .join( '\n' );
        }

        return null;
    }

    public getPath (): string {
        let path: string = this.children
            .map(child => child.format())
            .join(' > ');

        if (this.attribute != null) {
            return path + `[prop(${this.attribute})]`;
        }

        if (this.valueStart != null) {
            if (this.valueSingle) {
                return path + `[val(${this.valueStart})]`;
            } else if (this.valueEnd == null) {
                return path + `[val(${this.valueStart}..)]`;
            } else {
                return path + `[val(${this.valueStart}..${this.valueEnd})]`;
            }
        }

        return path;
    }
}

export class NodesReaderChild {
    public tagName: string;

    public index: number;

    protected childIndexTypes: Record<string, number> = {};

    public constructor (tagName: string, index?: number) {
        this.tagName = tagName;
        this.index = index;
    }

    public allocateIndex(tagName: string) : number {
        if (tagName in this.childIndexTypes) {
            return this.childIndexTypes[tagName]++;
        } else {
            this.childIndexTypes[tagName] = 1;

            return 0;
        }
    }

    public hasAllocated(tagName: string) : boolean {
        return tagName in this.childIndexTypes;
    }

    public format () {
        if (this.index != null) {
            return `${this.tagName}[nth(${this.index})]`;
        } else {
            return this.tagName;
        }
    }
}

export class NodesReaderError extends Error {
    protected reader: NodesReader;

    public get prettyMessage (): string {
        return this.reader.prettyErrorMessage;
    }

    public get errors (): NodesReaderDeserializationError[] {
        return this.reader.errors;
    }

    public constructor(reader: NodesReader) {
        super(reader.errorMessage);

        this.reader = reader;
    }
}
