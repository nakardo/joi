'use strict';

const Assert = require('@hapi/hoek/lib/assert');

const Common = require('./common');
const Ref = require('./ref');


const internals = {};


exports.schema = function (Joi, config, options = {}) {

    Common.assertOptions(options, ['appendPath']);

    try {
        return internals.schema(Joi, config);
    }
    catch (err) {
        if (options.appendPath &&
            err.path !== undefined) {

            err.message = `${err.message} (${err.path})`;
        }

        throw err;
    }
};


internals.schema = function (Joi, config) {

    Assert(config !== undefined, 'Invalid undefined schema');

    if (Array.isArray(config)) {
        Assert(config.length, 'Invalid empty array schema');

        if (config.length === 1) {
            config = config[0];
        }
    }

    if (internals.simple(config)) {
        return Joi.valid(config);
    }

    Assert(typeof config === 'object', 'Invalid schema content:', typeof config);

    if (Common.isResolvable(config)) {
        return Joi.valid(config);
    }

    if (Common.isSchema(config)) {
        return config;
    }

    if (Array.isArray(config)) {
        for (const valid of config) {
            if (!internals.simple(valid)) {
                return Joi.alternatives().try(...config);
            }
        }

        return Joi.valid(...config);
    }

    if (config instanceof RegExp) {
        return Joi.string().regex(config);
    }

    if (config instanceof Date) {
        return Joi.date().valid(config);
    }

    Assert(Object.getPrototypeOf(config) === Object.getPrototypeOf({}), 'Schema can only contain plain objects');

    return Joi.object().keys(config);
};


exports.ref = function (id, options) {

    return Ref.isRef(id) ? id : Ref.create(id, options);
};


exports.compile = function (root, schema, options = {}) {

    Common.assertOptions(options, ['legacy']);

    // Compiled by any supported version

    const any = schema && schema[Common.symbols.any];
    if (any) {
        Assert(options.legacy || any.version === Common.version, 'Cannot mix different versions of joi schemas');
        return schema;
    }

    // Uncompiled root

    if (typeof schema !== 'object' ||
        !options.legacy) {

        return exports.schema(root, schema, { appendPath: true });          // Will error if schema contains other versions
    }

    // Scan schema for compiled parts

    const compiler = internals.walk(schema);
    if (!compiler) {
        return exports.schema(root, schema, { appendPath: true });
    }

    return compiler.compile(compiler.root, schema);
};


internals.walk = function (schema) {

    if (typeof schema !== 'object') {
        return null;
    }

    if (Array.isArray(schema)) {
        for (const item of schema) {
            const compiler = internals.walk(item);
            if (compiler) {
                return compiler;
            }
        }

        return null;
    }

    const any = schema[Common.symbols.any];
    if (any) {
        return { root: schema[any.root], compile: any.compile };
    }

    Assert(Object.getPrototypeOf(schema) === Object.getPrototypeOf({}), 'Schema can only contain plain objects');

    for (const key in schema) {
        const compiler = internals.walk(schema[key]);
        if (compiler) {
            return compiler;
        }
    }

    return null;
};


internals.simple = function (value) {

    return value === null || ['boolean', 'string', 'number'].includes(typeof value);
};


exports.when = function (schema, condition, options) {

    if (Array.isArray(options)) {
        options = { switch: options };
    }

    Common.assertOptions(options, ['is', 'then', 'otherwise', 'switch']);

    // Schema condition

    if (Common.isSchema(condition)) {
        Assert(options.is === undefined, '"is" can not be used with a schema condition');
        Assert(options.switch === undefined, '"switch" can not be used with a schema condition');

        return internals.condition(schema, { is: condition, then: options.then, otherwise: options.otherwise });
    }

    // Single condition

    Assert(Ref.isRef(condition) || typeof condition === 'string', 'Invalid condition:', condition);
    Assert(options.is !== undefined || options.switch !== undefined, 'Missing "is" or "switch" option');

    if (options.is !== undefined) {
        Assert(options.then !== undefined || options.otherwise !== undefined, 'options must have at least one of "then", "otherwise", or "switch"');

        let is = schema.$_compile(options.is);
        if (!Ref.isRef(options.is) &&
            !Common.isSchema(options.is)) {

            is = is.required();                     // Only apply required if this wasn't already a schema or a ref
        }

        return internals.condition(schema, { ref: exports.ref(condition), is, then: options.then, otherwise: options.otherwise });
    }

    // Switch statement

    Assert(Array.isArray(options.switch), '"switch" must be an array');
    Assert(options.is === undefined, 'Cannot combine "switch" with "is"');
    Assert(options.then === undefined, 'Cannot combine "switch" with "then"');

    const rule = {
        ref: exports.ref(condition),
        switch: []
    };

    for (let i = 0; i < options.switch.length; ++i) {
        const test = options.switch[i];
        const last = i === options.switch.length - 1;

        Common.assertOptions(test, last ? ['is', 'then', 'otherwise'] : ['is', 'then']);

        Assert(test.is !== undefined, 'Switch statement missing "is"');
        Assert(test.then !== undefined, 'Switch statement missing "then"');

        const item = {
            is: schema.$_compile(test.is),
            then: schema.$_compile(test.then)
        };

        if (!Ref.isRef(test.is) &&
            !Common.isSchema(test.is)) {

            item.is = item.is.required();           // Only apply required if this wasn't already a schema or a ref
        }

        if (last) {
            Assert(options.otherwise === undefined || test.otherwise === undefined, 'Cannot specify "otherwise" inside and outside a "switch"');
            const otherwise = options.otherwise !== undefined ? options.otherwise : test.otherwise;
            if (otherwise !== undefined) {
                item.otherwise = schema.$_compile(otherwise);
            }
        }

        rule.switch.push(item);
    }

    return rule;
};


internals.condition = function (schema, condition) {

    for (const key of ['then', 'otherwise']) {
        if (condition[key] === undefined) {
            delete condition[key];
        }
        else {
            condition[key] = schema.$_compile(condition[key]);
        }
    }

    return condition;
};
