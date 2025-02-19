'use strict';

const Assert = require('@hapi/hoek/lib/assert');

const Any = require('./any');
const Common = require('../common');
const Compile = require('../compile');
const Errors = require('../errors');
const Ref = require('../ref');


const internals = {};


module.exports = Any.extend({

    type: 'alternatives',

    flags: {

        match: { default: 'any' }                 // 'any', 'one', 'all'
    },

    terms: {

        matches: { init: [], register: Ref.toSibling }
    },

    args(schema, ...schemas) {

        if (schemas.length === 1) {
            if (Array.isArray(schemas[0])) {
                return schema.try(...schemas[0]);
            }
        }

        return schema.try(...schemas);
    },

    validate(schema, value, { error, state, prefs }) {

        // Match all or one

        if (schema._flags.match) {
            let hits = 0;
            let matched;

            for (const item of schema.$_terms.matches) {
                const result = item.schema.$_validate(value, state.nest(item.schema), prefs);
                if (!result.errors) {
                    ++hits;
                    matched = result.value;
                }
            }

            if (!hits) {
                return { errors: error('alternatives.any') };
            }

            if (schema._flags.match === 'one') {
                return hits === 1 ? { value: matched } : { errors: error('alternatives.one') };
            }

            return hits === schema.$_terms.matches.length ? { value } : { errors: error('alternatives.all') };
        }

        // Match any

        const errors = [];
        for (const item of schema.$_terms.matches) {

            // Try

            if (item.schema) {
                const result = item.schema.$_validate(value, state.nest(item.schema), prefs);
                if (!result.errors) {
                    return result;
                }

                errors.push(...result.errors);
                continue;
            }

            // Conditional

            const input = item.ref ? item.ref.resolve(value, state, prefs) : value;
            const tests = item.is ? [item] : item.switch;

            for (const test of tests) {
                const { is, then, otherwise } = test;

                if (!is.$_match(input, state.nest(is), prefs)) {
                    if (otherwise) {
                        return otherwise.$_validate(value, state.nest(otherwise), prefs);
                    }
                }
                else if (then) {
                    return then.$_validate(value, state.nest(then), prefs);
                }
            }
        }

        // Nothing matched due to type criteria rules

        if (!errors.length) {
            return { errors: error('alternatives.any') };
        }

        // Single error

        if (errors.length === 1) {
            return { errors };
        }

        // All rules are base types

        const types = [];
        for (const report of errors) {
            if (report instanceof Errors.Report === false) {
                return { errors: error('alternatives.match', Errors.details(errors, { override: false })) };
            }

            if (report.state.path.length !== state.path.length) {
                return { errors: error('alternatives.match', Errors.details(errors, { override: false })) };
            }

            const [type, code] = report.code.split('.');
            if (code !== 'base') {
                return { errors: error('alternatives.match', Errors.details(errors, { override: false })) };
            }

            types.push(type);
        }

        // Complex reasons

        return { errors: error('alternatives.types', { types }) };
    },

    rules: {

        conditional: {
            method(condition, options) {

                Assert(!this._flags._endedSwitch, 'Unreachable condition');
                Assert(!this._flags.match, 'Cannot combine match mode', this._flags.match, 'with conditional rule');

                const obj = this.clone();

                const match = Compile.when(obj, condition, options);
                const conditions = match.is ? [match] : match.switch;
                for (const item of conditions) {
                    if (item.then &&
                        item.otherwise) {

                        obj.$_setFlag('_endedSwitch', true, { clone: false });
                        break;
                    }
                }

                obj.$_terms.matches.push(match);
                return obj.$_mutateRebuild();
            }
        },

        match: {
            method(mode) {

                Assert(['any', 'one', 'all'].includes(mode), 'Invalid alternatives match mode', mode);

                if (mode !== 'any') {
                    for (const match of this.$_terms.matches) {
                        Assert(match.schema, 'Cannot combine match mode', mode, 'with conditional rules');
                    }
                }

                return this.$_setFlag('match', mode);
            }
        },

        try: {
            method(...schemas) {

                Assert(schemas.length, 'Missing alternative schemas');
                Common.verifyFlat(schemas, 'try');

                Assert(!this._flags._endedSwitch, 'Unreachable condition');

                const obj = this.clone();
                for (const schema of schemas) {
                    obj.$_terms.matches.push({ schema: obj.$_compile(schema) });
                }

                return obj.$_mutateRebuild();
            }
        }
    },

    overrides: {

        label(name) {

            const obj = this.$_super.label(name);
            const each = (item, source, key) => (key !== 'is' ? item.label(name) : undefined);
            return obj.$_modify({ each, ref: false });
        }
    },

    rebuild(schema) {

        // Flag when an alternative type is an array

        const each = (item) => {

            if (Common.isSchema(item) &&
                item.type === 'array') {

                schema.$_setFlag('_arrayItems', true, { clone: false });
            }
        };

        schema.$_modify({ each });
    },

    manifest: {

        build(obj, desc) {

            if (desc.matches) {
                for (const match of desc.matches) {
                    const { schema, ref, is, then, otherwise } = match;
                    if (schema) {
                        obj = obj.try(schema);
                    }
                    else if (ref) {
                        obj = obj.conditional(ref, { is, then, otherwise, switch: match.switch });
                    }
                    else {
                        obj = obj.conditional(is, { then, otherwise });
                    }
                }
            }

            return obj;
        }
    },

    messages: {
        'alternatives.all': '"{{#label}}" does not match all of the required types',
        'alternatives.any': '"{{#label}}" does not match any of the allowed types',
        'alternatives.match': '"{{#label}}" does not match any of the allowed types',
        'alternatives.one': '"{{#label}}" matches more than one allowed type',
        'alternatives.types': '"{{#label}}" must be one of {{#types}}'
    }
});
