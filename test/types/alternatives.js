'use strict';

const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Joi = require('../..');

const Helper = require('../helper');


const internals = {};


const { describe, it } = exports.lab = Lab.script();
const { expect } = Code;


describe('alternatives', () => {

    it('fails when no alternatives are provided', () => {

        const err = Joi.alternatives().validate('a').error;
        expect(err.message).to.equal('"value" does not match any of the allowed types');
        expect(err.details).to.equal([
            {
                context: {
                    label: 'value',
                    value: 'a'
                },
                message: '"value" does not match any of the allowed types',
                path: [],
                type: 'alternatives.any'
            }
        ]);
    });

    it('allows undefined when no alternatives are provided', () => {

        expect(Joi.alternatives().validate(undefined)).to.equal({ value: undefined });
    });

    it('applies modifiers when higher priority converts', () => {

        const schema = Joi.object({
            a: [
                Joi.number(),
                Joi.string()
            ]
        });

        expect(schema.validate({ a: '5' })).to.equal({ value: { a: 5 } });
    });

    it('applies modifiers when lower priority valid is a match', () => {

        const schema = Joi.object({
            a: [
                Joi.number(),
                Joi.valid('5')
            ]
        });

        expect(schema.validate({ a: '5' })).to.equal({ value: { a: 5 } });
    });

    it('does not apply modifier if alternative fails', () => {

        const schema = Joi.object({
            a: [
                Joi.object({ c: Joi.any(), d: Joi.number() }).rename('b', 'c'),
                { b: Joi.any(), d: Joi.string() }
            ]
        });

        const input = { a: { b: 'any', d: 'string' } };
        expect(schema.validate(input)).to.equal({ value: { a: { b: 'any', d: 'string' } } });
    });

    it('consolidates types only when all coming from top level base errors', () => {

        const schema = Joi.alternatives(
            Joi.string(),
            Joi.array().items(Joi.string())
        );

        expect(schema.validate([1]).error).to.be.an.error('"value" does not match any of the allowed types');
    });

    describe('conditional()', () => {

        it('throws on invalid ref (not string)', () => {

            expect(() => Joi.alternatives().conditional(5, { is: 6, then: Joi.number() })).to.throw('Invalid condition: 5');
        });

        it('throws on unreachable condition', () => {

            expect(() => {

                Joi.object({

                    a: Joi.alternatives().conditional('b', { is: 6, then: 7, otherwise: 0 }).conditional('b', { is: 6, then: 7 }),
                    b: Joi.any()
                });
            }).to.throw('Unreachable condition');
        });

        it('tests only otherwise', () => {

            const schema = Joi.object({
                a: Joi.number().required(),
                b: Joi.alternatives().conditional('a', { is: 0, otherwise: Joi.valid(1) })
            });

            Helper.validate(schema, [
                [{ a: 1, b: 1 }, true],
                [{ a: 0, b: 2 }, false, null, {
                    message: '"b" does not match any of the allowed types',
                    details: [{
                        message: '"b" does not match any of the allowed types',
                        path: ['b'],
                        type: 'alternatives.any',
                        context: { value: 2, label: 'b', key: 'b' }
                    }]
                }]
            ]);
        });

        describe('with ref', () => {

            it('validates conditional alternatives', () => {

                const schema = Joi.object({
                    a: Joi.alternatives()
                        .conditional('b', { is: 5, then: 'x', otherwise: 'y' }),
                    b: Joi.any()
                });

                Helper.validate(schema, [
                    [{ a: 'x', b: 5 }, true],
                    [{ a: 'x', b: 6 }, false, null, {
                        message: '"a" must be one of [y]',
                        details: [{
                            message: '"a" must be one of [y]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'x', valids: ['y'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y', b: 5 }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y', b: 6 }, true],
                    [{ a: 'z', b: 5 }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'z', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'z', b: 6 }, false, null, {
                        message: '"a" must be one of [y]',
                        details: [{
                            message: '"a" must be one of [y]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'z', valids: ['y'], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates conditional alternatives (self reference, explicit)', () => {

                const schema = Joi.alternatives()
                    .conditional(Joi.ref('a', { ancestor: 0 }), {
                        is: true,
                        then: {
                            a: Joi.boolean().required(),
                            b: Joi.string().required()
                        },
                        otherwise: {
                            a: Joi.boolean().required(),
                            c: Joi.string().required()
                        }
                    });

                Helper.validate(schema, [
                    [{ a: true, b: 'x' }, true],
                    [{ a: true, b: 5 }, false, null, {
                        message: '"b" must be a string',
                        details: [{
                            message: '"b" must be a string',
                            path: ['b'],
                            type: 'string.base',
                            context: { value: 5, key: 'b', label: 'b' }
                        }]
                    }],
                    [{ a: true }, false, null, {
                        message: '"b" is required',
                        details: [{
                            message: '"b" is required',
                            path: ['b'],
                            type: 'any.required',
                            context: { key: 'b', label: 'b' }
                        }]
                    }],
                    [{ a: true, c: 5 }, false, null, {
                        message: '"b" is required',
                        details: [{
                            message: '"b" is required',
                            path: ['b'],
                            type: 'any.required',
                            context: { key: 'b', label: 'b' }
                        }]
                    }],
                    [{ a: true, c: 'x' }, false, null, {
                        message: '"b" is required',
                        details: [{
                            message: '"b" is required',
                            path: ['b'],
                            type: 'any.required',
                            context: { key: 'b', label: 'b' }
                        }]
                    }],

                    [{ a: false, b: 'x' }, false, null, {
                        message: '"c" is required',
                        details: [{
                            message: '"c" is required',
                            path: ['c'],
                            type: 'any.required',
                            context: { key: 'c', label: 'c' }
                        }]
                    }],
                    [{ a: false, b: 5 }, false, null, {
                        message: '"c" is required',
                        details: [{
                            message: '"c" is required',
                            path: ['c'],
                            type: 'any.required',
                            context: { key: 'c', label: 'c' }
                        }]
                    }],
                    [{ a: false }, false, null, {
                        message: '"c" is required',
                        details: [{
                            message: '"c" is required',
                            path: ['c'],
                            type: 'any.required',
                            context: { key: 'c', label: 'c' }
                        }]
                    }],
                    [{ a: false, c: 5 }, false, null, {
                        message: '"c" must be a string',
                        details: [{
                            message: '"c" must be a string',
                            path: ['c'],
                            type: 'string.base',
                            context: { value: 5, key: 'c', label: 'c' }
                        }]
                    }],
                    [{ a: false, c: 'x' }, true]
                ]);
            });

            it('validates conditional alternatives (self reference, implicit)', () => {

                const schema = Joi.alternatives()
                    .conditional('.a', {
                        is: true,
                        then: {
                            a: Joi.boolean().required(),
                            b: Joi.string().required()
                        },
                        otherwise: {
                            a: Joi.boolean().required(),
                            c: Joi.string().required()
                        }
                    });

                Helper.validate(schema, [
                    [{ a: true, b: 'x' }, true],
                    [{ a: true, b: 5 }, false, null, {
                        message: '"b" must be a string',
                        details: [{
                            message: '"b" must be a string',
                            path: ['b'],
                            type: 'string.base',
                            context: { value: 5, key: 'b', label: 'b' }
                        }]
                    }],
                    [{ a: true }, false, null, {
                        message: '"b" is required',
                        details: [{
                            message: '"b" is required',
                            path: ['b'],
                            type: 'any.required',
                            context: { key: 'b', label: 'b' }
                        }]
                    }],
                    [{ a: true, c: 5 }, false, null, {
                        message: '"b" is required',
                        details: [{
                            message: '"b" is required',
                            path: ['b'],
                            type: 'any.required',
                            context: { key: 'b', label: 'b' }
                        }]
                    }],
                    [{ a: true, c: 'x' }, false, null, {
                        message: '"b" is required',
                        details: [{
                            message: '"b" is required',
                            path: ['b'],
                            type: 'any.required',
                            context: { key: 'b', label: 'b' }
                        }]
                    }],

                    [{ a: false, b: 'x' }, false, null, {
                        message: '"c" is required',
                        details: [{
                            message: '"c" is required',
                            path: ['c'],
                            type: 'any.required',
                            context: { key: 'c', label: 'c' }
                        }]
                    }],
                    [{ a: false, b: 5 }, false, null, {
                        message: '"c" is required',
                        details: [{
                            message: '"c" is required',
                            path: ['c'],
                            type: 'any.required',
                            context: { key: 'c', label: 'c' }
                        }]
                    }],
                    [{ a: false }, false, null, {
                        message: '"c" is required',
                        details: [{
                            message: '"c" is required',
                            path: ['c'],
                            type: 'any.required',
                            context: { key: 'c', label: 'c' }
                        }]
                    }],
                    [{ a: false, c: 5 }, false, null, {
                        message: '"c" must be a string',
                        details: [{
                            message: '"c" must be a string',
                            path: ['c'],
                            type: 'string.base',
                            context: { value: 5, key: 'c', label: 'c' }
                        }]
                    }],
                    [{ a: false, c: 'x' }, true]
                ]);
            });

            it('validates conditional alternatives (empty key)', () => {

                const schema = Joi.object({
                    a: Joi.alternatives()
                        .conditional('', { is: 5, then: 'x', otherwise: 'y' }),
                    '': Joi.any()
                });

                Helper.validate(schema, [
                    [{ a: 'x', '': 5 }, true],
                    [{ a: 'x', '': 6 }, false, null, {
                        message: '"a" must be one of [y]',
                        details: [{
                            message: '"a" must be one of [y]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'x', valids: ['y'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y', '': 5 }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y', '': 6 }, true],
                    [{ a: 'z', '': 5 }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'z', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'z', '': 6 }, false, null, {
                        message: '"a" must be one of [y]',
                        details: [{
                            message: '"a" must be one of [y]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'z', valids: ['y'], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates only then', () => {

                const schema = Joi.object({
                    a: Joi.alternatives()
                        .conditional(Joi.ref('b'), { is: 5, then: 'x' })
                        .try('z'),
                    b: Joi.any()
                });

                Helper.validate(schema, [
                    [{ a: 'x', b: 5 }, true],
                    [{ a: 'x', b: 6 }, false, null, {
                        message: '"a" must be one of [z]',
                        details: [{
                            message: '"a" must be one of [z]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'x', valids: ['z'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y', b: 5 }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y', b: 6 }, false, null, {
                        message: '"a" must be one of [z]',
                        details: [{
                            message: '"a" must be one of [z]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['z'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'z', b: 5 }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'z', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'z', b: 6 }, true]
                ]);
            });

            it('validates only otherwise', () => {

                const schema = Joi.object({
                    a: Joi.alternatives()
                        .conditional('b', { is: 5, otherwise: 'y' })
                        .try('z'),
                    b: Joi.any()
                });

                Helper.validate(schema, [
                    [{ a: 'x', b: 5 }, false, null, {
                        message: '"a" must be one of [z]',
                        details: [{
                            message: '"a" must be one of [z]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'x', valids: ['z'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'x', b: 6 }, false, null, {
                        message: '"a" must be one of [y]',
                        details: [{
                            message: '"a" must be one of [y]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'x', valids: ['y'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y', b: 5 }, false, null, {
                        message: '"a" must be one of [z]',
                        details: [{
                            message: '"a" must be one of [z]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['z'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y', b: 6 }, true],
                    [{ a: 'z', b: 5 }, true],
                    [{ a: 'z', b: 6 }, false, null, {
                        message: '"a" must be one of [y]',
                        details: [{
                            message: '"a" must be one of [y]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'z', valids: ['y'], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates "then" when a preceding "when" has only "otherwise"', () => {

                const schema = Joi.object({
                    a: Joi.number(),
                    b: Joi.number(),
                    c: Joi.alternatives()
                        .conditional('a', { is: 1, otherwise: Joi.number().min(1) })
                        .conditional('b', { is: 1, then: Joi.number().min(1), otherwise: Joi.number() })
                });

                Helper.validate(schema, [
                    [{ a: 1, b: 1, c: 0 }, false, null, {
                        message: '"c" must be larger than or equal to 1',
                        details: [{
                            message: '"c" must be larger than or equal to 1',
                            path: ['c'],
                            type: 'number.min',
                            context: { limit: 1, value: 0, label: 'c', key: 'c' }
                        }]
                    }],
                    [{ a: 1, b: 1, c: 1 }, true],
                    [{ a: 0, b: 1, c: 1 }, true],
                    [{ a: 1, b: 0, c: 0 }, true]
                ]);
            });

            it('validates when is is null', () => {

                const schema = Joi.object({
                    a: Joi.alternatives().conditional('b', { is: null, then: 'x', otherwise: Joi.number() }),
                    b: Joi.any()
                });

                Helper.validate(schema, [
                    [{ a: 1 }, true],
                    [{ a: 'y' }, false, null, {
                        message: '"a" must be a number',
                        details: [{
                            message: '"a" must be a number',
                            path: ['a'],
                            type: 'number.base',
                            context: { label: 'a', key: 'a', value: 'y' }
                        }]
                    }],
                    [{ a: 'x', b: null }, true],
                    [{ a: 'y', b: null }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 1, b: null }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 1, valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates when is has ref', () => {

                const schema = Joi.object({
                    a: Joi.alternatives().conditional('b', { is: Joi.ref('c'), then: 'x' }),
                    b: Joi.any(),
                    c: Joi.number()
                });

                Helper.validate(schema, [
                    [{ a: 'x', b: 5, c: '5' }, true],
                    [{ a: 'x', b: 5, c: '1' }, false, null, {
                        message: '"a" does not match any of the allowed types',
                        details: [{
                            message: '"a" does not match any of the allowed types',
                            path: ['a'],
                            type: 'alternatives.any',
                            context: { label: 'a', key: 'a', value: 'x' }
                        }]
                    }],
                    [{ a: 'x', b: '5', c: '5' }, false, null, {
                        message: '"a" does not match any of the allowed types',
                        details: [{
                            message: '"a" does not match any of the allowed types',
                            path: ['a'],
                            type: 'alternatives.any',
                            context: { label: 'a', key: 'a', value: 'x' }
                        }]
                    }],
                    [{ a: 'y', b: 5, c: 5 }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y' }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates when is has ref pointing to a complex type', () => {

                const date = new Date(42);

                const schema = Joi.object({
                    a: Joi.alternatives().conditional('b', { is: Joi.ref('c'), then: 'x' }),
                    b: Joi.date(),
                    c: Joi.date()
                });

                Helper.validate(schema, [
                    [{ a: 'x', b: date, c: date }, true],
                    [{ a: 'x', b: date, c: Date.now() }, false, null, {
                        message: '"a" does not match any of the allowed types',
                        details: [{
                            message: '"a" does not match any of the allowed types',
                            path: ['a'],
                            type: 'alternatives.any',
                            context: { label: 'a', key: 'a', value: 'x' }
                        }]
                    }],
                    [{ a: 'y', b: date, c: date }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y' }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });


            it('validates when is has either ref pointing to a complex type or value', () => {

                const date = new Date(42);
                const now = Date.now();

                const schema = Joi.object({
                    a: Joi.alternatives().conditional('b', {
                        is: Joi.valid(
                            new Date(+date), // Intentional cloning of the date to change the reference
                            Joi.ref('c')
                        ),
                        then: 'x'
                    }),
                    b: Joi.date(),
                    c: Joi.date()
                });

                Helper.validate(schema, [
                    [{ a: 'x', b: date, c: date }, true],
                    [{ a: 'x', b: date, c: now }, true, null, { a: 'x', b: date, c: new Date(now) }],
                    [{ a: 'y', b: date, c: date }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 'y' }, false, null, {
                        message: '"a" must be one of [x]',
                        details: [{
                            message: '"a" must be one of [x]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'y', valids: ['x'], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates when then has ref', () => {

                const ref = Joi.ref('c');
                const schema = Joi.object({
                    a: Joi.alternatives().conditional('b', { is: 5, then: ref }),
                    b: Joi.any(),
                    c: Joi.number()
                });

                Helper.validate(schema, [
                    [{ a: 'x', b: 5, c: '1' }, false, null, {
                        message: '"a" must be one of [ref:c]',
                        details: [{
                            message: '"a" must be one of [ref:c]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'x', valids: [ref], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 1, b: 5, c: '1' }, true],
                    [{ a: '1', b: 5, c: '1' }, false, null, {
                        message: '"a" must be one of [ref:c]',
                        details: [{
                            message: '"a" must be one of [ref:c]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: '1', valids: [ref], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates when otherwise has ref', () => {

                const ref = Joi.ref('c');
                const schema = Joi.object({
                    a: Joi.alternatives().conditional('b', { is: 6, otherwise: ref }),
                    b: Joi.any(),
                    c: Joi.number()
                });

                Helper.validate(schema, [
                    [{ a: 'x', b: 5, c: '1' }, false, null, {
                        message: '"a" must be one of [ref:c]',
                        details: [{
                            message: '"a" must be one of [ref:c]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: 'x', valids: [ref], label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 1, b: 5, c: '1' }, true],
                    [{ a: '1', b: 5, c: '1' }, false, null, {
                        message: '"a" must be one of [ref:c]',
                        details: [{
                            message: '"a" must be one of [ref:c]',
                            path: ['a'],
                            type: 'any.only',
                            context: { value: '1', valids: [ref], label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates when empty value', () => {

                const schema = Joi.object({
                    a: Joi.alternatives().conditional('b', { is: true, then: Joi.required() }),
                    b: Joi.boolean().default(false)
                });

                Helper.validate(schema, [
                    [{ b: false }, true],
                    [{ b: true }, true]           // true because required() only applies to the one alternative
                ]);
            });

            it('validates when missing value', () => {

                const schema = Joi.object({
                    a: Joi.alternatives().conditional('b', {
                        is: 5,
                        then: Joi.optional(),
                        otherwise: Joi.required()
                    }).required(),
                    b: Joi.number()
                });

                Helper.validate(schema, [
                    [{ a: 1 }, true],
                    [{}, false, null, {
                        message: '"a" is required',
                        details: [{
                            message: '"a" is required',
                            path: ['a'],
                            type: 'any.required',
                            context: { label: 'a', key: 'a' }
                        }]
                    }],
                    [{ b: 1 }, false, null, {
                        message: '"a" is required',
                        details: [{
                            message: '"a" is required',
                            path: ['a'],
                            type: 'any.required',
                            context: { label: 'a', key: 'a' }
                        }]
                    }],
                    [{ a: 1, b: 1 }, true],
                    [{ a: 1, b: 5 }, true],
                    [{ b: 5 }, false, null, {
                        message: '"a" is required',
                        details: [{
                            message: '"a" is required',
                            path: ['a'],
                            type: 'any.required',
                            context: { label: 'a', key: 'a' }
                        }]
                    }]
                ]);
            });

            it('validates with nested whens', () => {

                // If ((b === 0 && a === 123) ||
                //     (b !== 0 && a === anything))
                // then c === 456
                // else c === 789

                const schema = Joi.object({
                    a: Joi.number().required(),
                    b: Joi.number().required(),
                    c: Joi.alternatives().conditional('a', {
                        is: Joi.alternatives().conditional('b', {
                            is: Joi.valid(0),
                            then: Joi.valid(123),
                            otherwise: Joi.any()
                        }),
                        then: Joi.valid(456),
                        otherwise: Joi.valid(789)
                    })
                });

                Helper.validate(schema, [
                    [{ a: 123, b: 0, c: 456 }, true],
                    [{ a: 0, b: 1, c: 456 }, true],
                    [{ a: 0, b: 0, c: 789 }, true],
                    [{ a: 123, b: 456, c: 456 }, true],
                    [{ a: 0, b: 0, c: 456 }, false, null, {
                        message: '"c" must be one of [789]',
                        details: [{
                            message: '"c" must be one of [789]',
                            path: ['c'],
                            type: 'any.only',
                            context: { value: 456, valids: [789], label: 'c', key: 'c' }
                        }]
                    }],
                    [{ a: 123, b: 456, c: 789 }, false, null, {
                        message: '"c" must be one of [456]',
                        details: [{
                            message: '"c" must be one of [456]',
                            path: ['c'],
                            type: 'any.only',
                            context: { value: 789, valids: [456], label: 'c', key: 'c' }
                        }]
                    }]
                ]);
            });
        });

        describe('with schema', () => {

            it('should peek inside a simple value', () => {

                const schema = Joi.alternatives()
                    .conditional(Joi.number().min(0), { then: Joi.number().min(10), otherwise: Joi.number() });

                Helper.validate(schema, [
                    [-1, true, null, -1],
                    [1, false, null, {
                        message: '"value" must be larger than or equal to 10',
                        details: [{
                            message: '"value" must be larger than or equal to 10',
                            path: [],
                            type: 'number.min',
                            context: { limit: 10, value: 1, label: 'value' }
                        }]
                    }],
                    [10, true, null, 10]
                ]);
            });

            it('should peek inside an object', () => {

                const schema = Joi.alternatives()
                    .conditional(Joi.object().keys({ foo: Joi.valid('hasBar').required() }).unknown(), {
                        then: Joi.object({
                            foo: Joi.string(),
                            bar: Joi.number().required()
                        }),
                        otherwise: Joi.object({
                            foo: Joi.string(),
                            bar: Joi.number()
                        })
                    });

                Helper.validate(schema, [
                    [{ foo: 'whatever' }, true, null, { foo: 'whatever' }],
                    [{ foo: 'hasBar' }, false, null, {
                        message: '"bar" is required',
                        details: [{
                            message: '"bar" is required',
                            path: ['bar'],
                            type: 'any.required',
                            context: { key: 'bar', label: 'bar' }
                        }]
                    }],
                    [{ foo: 'hasBar', bar: 42 }, true, null, { foo: 'hasBar', bar: 42 }],
                    [{}, true, null, {}]
                ]);
            });
        });

        describe('with switch', () => {

            it('sets value based on multiple conditions', () => {

                const schema = Joi.object({
                    a: Joi.number().required(),
                    b: Joi.alternatives()
                        .conditional('a', [
                            { is: 0, then: Joi.valid(1) },
                            { is: 1, then: Joi.valid(2) },
                            { is: 2, then: Joi.valid(3), otherwise: Joi.valid(4) }
                        ])
                });

                Helper.validate(schema, [
                    [{ a: 0, b: 1 }, true],
                    [{ a: 0, b: 2 }, false, null, {
                        message: '"b" must be one of [1]',
                        details: [{
                            message: '"b" must be one of [1]',
                            path: ['b'],
                            type: 'any.only',
                            context: { value: 2, valids: [1], label: 'b', key: 'b' }
                        }]
                    }],
                    [{ a: 1, b: 2 }, true],
                    [{ a: 1, b: 3 }, false, null, {
                        message: '"b" must be one of [2]',
                        details: [{
                            message: '"b" must be one of [2]',
                            path: ['b'],
                            type: 'any.only',
                            context: { value: 3, valids: [2], label: 'b', key: 'b' }
                        }]
                    }],
                    [{ a: 2, b: 3 }, true],
                    [{ a: 2, b: 2 }, false, null, {
                        message: '"b" must be one of [3]',
                        details: [{
                            message: '"b" must be one of [3]',
                            path: ['b'],
                            type: 'any.only',
                            context: { value: 2, valids: [3], label: 'b', key: 'b' }
                        }]
                    }],
                    [{ a: 42, b: 4 }, true],
                    [{ a: 42, b: 128 }, false, null, {
                        message: '"b" must be one of [4]',
                        details: [{
                            message: '"b" must be one of [4]',
                            path: ['b'],
                            type: 'any.only',
                            context: { value: 128, valids: [4], label: 'b', key: 'b' }
                        }]
                    }]
                ]);
            });
        });
    });

    describe('describe()', () => {

        it('describes when', () => {

            const schema = Joi.object({
                a: Joi.alternatives()
                    .conditional('b', { is: 5, then: 'x' })
                    .conditional('b', { is: 6, otherwise: 'y' })
                    .try('z'),
                b: Joi.any()
            });

            expect(schema.describe()).to.equal({
                type: 'object',
                keys: {
                    b: {
                        type: 'any'
                    },
                    a: {
                        type: 'alternatives',
                        matches: [
                            {
                                ref: { path: ['b'] },
                                is: {
                                    type: 'any',
                                    flags: {
                                        only: true,
                                        presence: 'required'
                                    },
                                    allow: [5]
                                },
                                then: {
                                    type: 'any',
                                    flags: {
                                        only: true
                                    },
                                    allow: ['x']
                                }
                            },
                            {
                                ref: { path: ['b'] },
                                is: {
                                    type: 'any',
                                    flags: {
                                        only: true,
                                        presence: 'required'
                                    },
                                    allow: [6]
                                },
                                otherwise: {
                                    type: 'any',
                                    flags: {
                                        only: true
                                    },
                                    allow: ['y']
                                }
                            },
                            {
                                schema: {
                                    type: 'any',
                                    flags: {
                                        only: true
                                    },
                                    allow: ['z']
                                }
                            }
                        ]
                    }
                }
            });
        });

        it('describes when (only then)', () => {

            const schema = Joi.object({
                a: Joi.alternatives()
                    .conditional('b', { is: 5, then: 'x' })
                    .try('z'),
                b: Joi.any()
            });

            expect(schema.describe()).to.equal({
                type: 'object',
                keys: {
                    b: {
                        type: 'any'
                    },
                    a: {
                        type: 'alternatives',
                        matches: [
                            {
                                ref: { path: ['b'] },
                                is: {
                                    type: 'any',
                                    flags: {
                                        only: true,
                                        presence: 'required'
                                    },
                                    allow: [5]
                                },
                                then: {
                                    type: 'any',
                                    flags: {
                                        only: true
                                    },
                                    allow: ['x']
                                }
                            },
                            {
                                schema: {
                                    type: 'any',
                                    flags: {
                                        only: true
                                    },
                                    allow: ['z']
                                }
                            }
                        ]
                    }
                }
            });
        });

        it('describes when (only otherwise)', () => {

            const schema = Joi.object({
                a: Joi.alternatives()
                    .conditional('b', { is: 5, otherwise: 'y' })
                    .try('z'),
                b: Joi.any()
            });

            expect(schema.describe()).to.equal({
                type: 'object',
                keys: {
                    b: {
                        type: 'any'
                    },
                    a: {
                        type: 'alternatives',
                        matches: [
                            {
                                ref: { path: ['b'] },
                                is: {
                                    type: 'any',
                                    flags: {
                                        only: true,
                                        presence: 'required'
                                    },
                                    allow: [5]
                                },
                                otherwise: {
                                    type: 'any',
                                    flags: {
                                        only: true
                                    },
                                    allow: ['y']
                                }
                            },
                            {
                                schema: {
                                    type: 'any',
                                    flags: {
                                        only: true
                                    },
                                    allow: ['z']
                                }
                            }
                        ]
                    }
                }
            });
        });

        it('describes when (with schema)', () => {

            const schema = Joi.alternatives()
                .conditional(Joi.string().label('foo'), {
                    then: Joi.string().required().min(1),
                    otherwise: Joi.boolean()
                });

            const outcome = {
                type: 'alternatives',
                matches: [{
                    is: {
                        type: 'string',
                        flags: {
                            label: 'foo'
                        }
                    },
                    then: {
                        type: 'string',
                        flags: { presence: 'required' },
                        rules: [{ args: { limit: 1 }, name: 'min' }]
                    },
                    otherwise: {
                        type: 'boolean'
                    }
                }]
            };

            expect(schema.describe()).to.equal(outcome);
        });

        it('describes inherited fields (from any)', () => {

            const schema = Joi.alternatives()
                .try('a')
                .description('d')
                .example('a')
                .meta('b')
                .meta('c')
                .note('f')
                .tag('g');

            const outcome = {
                type: 'alternatives',
                notes: ['f'],
                tags: ['g'],
                metas: ['b', 'c'],
                examples: ['a'],
                flags: {
                    description: 'd'
                },
                matches: [{
                    schema: {
                        type: 'any',
                        flags: {
                            only: true
                        },
                        allow: ['a']
                    }
                }]
            };

            expect(schema.describe()).to.equal(outcome);
        });
    });

    describe('error()', () => {

        it('overrides single try error', () => {

            const override = new Error('failed!');

            const schema = Joi.object({
                x: Joi.alternatives([
                    Joi.number(),
                    Joi.string().error(override)
                ])
            });

            const err = schema.validate({ x: [] }).error;
            expect(err).to.be.an.error('"x" does not match any of the allowed types');
            expect(err.details[0].context.details).to.equal([
                {
                    message: '"x" must be a number',
                    path: ['x'],
                    type: 'number.base',
                    context: { value: [], label: 'x', key: 'x' }
                },
                {
                    message: 'Error: failed!',
                    type: 'override',
                    context: {
                        error: override
                    }
                }
            ]);
        });

        it('overrides top level error', () => {

            const schema = Joi.object({
                x: Joi.alternatives([
                    Joi.number(),
                    Joi.string()
                ])
                    .error(new Error('failed!'))
            });

            expect(schema.validate({ x: [] }).error).to.be.an.error('failed!');
        });
    });

    describe('label()', () => {

        it('passes the label to the underlying schema', () => {

            const schema = Joi.object().keys({
                a: Joi.boolean(),

                b: Joi.alternatives().conditional('a', {
                    is: true,
                    then: Joi.string().empty('').allow(null),
                    otherwise: Joi.any()
                })
                    .label('Label b'),

                c: Joi.alternatives().conditional('a', {
                    is: true,
                    then: Joi.any(),
                    otherwise: Joi.string().empty('').allow(null)
                })
                    .label('Label c'),

                d: Joi.alt()
                    .try(Joi.string())
                    .label('Label d')
            })
                .or('b', 'c', 'd');

            Helper.validate(schema, [
                [{ a: true, b: 1 }, false, null, {
                    message: '"Label b" must be a string',
                    details: [{
                        message: '"Label b" must be a string',
                        path: ['b'],
                        type: 'string.base',
                        context: { value: 1, key: 'b', label: 'Label b' }
                    }]
                }],
                [{ a: false, b: 1, d: 1 }, false, null, {
                    message: '"Label d" must be a string',
                    details: [{
                        message: '"Label d" must be a string',
                        path: ['d'],
                        type: 'string.base',
                        context: { value: 1, key: 'd', label: 'Label d' }
                    }]
                }],
                [{ a: false, b: 1, c: 1 }, false, null, {
                    message: '"Label c" must be a string',
                    details: [{
                        message: '"Label c" must be a string',
                        path: ['c'],
                        type: 'string.base',
                        context: { value: 1, key: 'c', label: 'Label c' }
                    }]
                }]
            ]);
        });

        it('does not modify the original schema', () => {

            const schema = Joi.alternatives().conditional('a', {
                is: true,
                then: Joi.string().empty('').allow(null),
                otherwise: Joi.any()
            });

            const labeled = schema.label('Label b');

            expect(schema.describe()).to.equal({
                type: 'alternatives',
                matches: [{
                    is: {
                        type: 'any',
                        flags: { only: true, presence: 'required' },
                        allow: [true]
                    },
                    ref: { path: ['a'] },
                    then: {
                        type: 'string',
                        flags: {
                            empty: {
                                flags: { only: true },
                                type: 'any',
                                allow: ['']
                            }
                        },
                        allow: [null]
                    },
                    otherwise: { type: 'any' }
                }]
            });

            expect(labeled.describe()).to.equal({
                flags: {
                    label: 'Label b'
                },
                type: 'alternatives',
                matches: [{
                    is: {
                        type: 'any',
                        flags: { only: true, presence: 'required' },
                        allow: [true]
                    },
                    ref: { path: ['a'] },
                    then: {
                        type: 'string',
                        flags: {
                            label: 'Label b',
                            empty: {
                                flags: { only: true },
                                type: 'any',
                                allow: ['']
                            }
                        },
                        allow: [null]
                    },
                    otherwise: {
                        type: 'any',
                        flags: { label: 'Label b' }
                    }
                }]
            });
        });

        it('applies label to then', () => {

            const schema = Joi.object({
                a: Joi.boolean(),
                b: Joi.alternatives()
                    .conditional('a', { is: true, then: Joi.string() })
                    .label('x')
            });

            expect(schema.describe()).to.equal({
                type: 'object',
                keys: {
                    a: {
                        type: 'boolean'
                    },
                    b: {
                        type: 'alternatives',
                        flags: {
                            label: 'x'
                        },
                        matches: [
                            {
                                is: {
                                    type: 'any',
                                    allow: [true],
                                    flags: {
                                        only: true,
                                        presence: 'required'
                                    }
                                },
                                ref: {
                                    path: ['a']
                                },
                                then: {
                                    type: 'string',
                                    flags: {
                                        label: 'x'
                                    }
                                }
                            }
                        ]
                    }
                }
            });
        });

        it('applies label to otherwise', () => {

            const schema = Joi.object({
                a: Joi.boolean(),
                b: Joi.alternatives()
                    .conditional('a', { is: true, otherwise: Joi.string() })
                    .label('x')
            });

            expect(schema.describe()).to.equal({
                type: 'object',
                keys: {
                    a: {
                        type: 'boolean'
                    },
                    b: {
                        type: 'alternatives',
                        flags: {
                            label: 'x'
                        },
                        matches: [
                            {
                                is: {
                                    type: 'any',
                                    allow: [true],
                                    flags: {
                                        only: true,
                                        presence: 'required'
                                    }
                                },
                                ref: {
                                    path: ['a']
                                },
                                otherwise: {
                                    type: 'string',
                                    flags: {
                                        label: 'x'
                                    }
                                }
                            }
                        ]
                    }
                }
            });
        });
    });

    describe('match()', () => {

        it('matches one', () => {

            const schema = Joi.alternatives([
                Joi.number(),
                Joi.string()
            ])
                .match('one');

            Helper.validate(schema, [
                [0, true, null, 0],
                ['x', true, null, 'x'],
                ['2', false, null, {
                    message: '"value" matches more than one allowed type',
                    details: [{
                        message: '"value" matches more than one allowed type',
                        path: [],
                        type: 'alternatives.one',
                        context: { label: 'value', value: '2' }
                    }]
                }],
                [true, false, null, {
                    message: '"value" does not match any of the allowed types',
                    details: [{
                        message: '"value" does not match any of the allowed types',
                        path: [],
                        type: 'alternatives.any',
                        context: { label: 'value', value: true }
                    }]
                }]
            ]);
        });

        it('matches one (retains coerce)', () => {

            const schema = Joi.alternatives([
                Joi.number(),
                Joi.boolean()
            ])
                .match('one');

            Helper.validate(schema, [
                ['2', true, null, 2]
            ]);
        });

        it('matches all', () => {

            const schema = Joi.alternatives([
                Joi.number(),
                Joi.string()
            ])
                .match('all');

            Helper.validate(schema, [
                ['2', true, null, '2'],
                ['x', false, null, {
                    message: '"value" does not match all of the required types',
                    details: [{
                        message: '"value" does not match all of the required types',
                        path: [],
                        type: 'alternatives.all',
                        context: { label: 'value', value: 'x' }
                    }]
                }],
                [2, false, null, {
                    message: '"value" does not match all of the required types',
                    details: [{
                        message: '"value" does not match all of the required types',
                        path: [],
                        type: 'alternatives.all',
                        context: { label: 'value', value: 2 }
                    }]
                }],
                [true, false, null, {
                    message: '"value" does not match any of the allowed types',
                    details: [{
                        message: '"value" does not match any of the allowed types',
                        path: [],
                        type: 'alternatives.any',
                        context: { label: 'value', value: true }
                    }]
                }]
            ]);
        });

        it('errors on mix with conditional', () => {

            expect(() => Joi.alternatives().match('all').conditional('$a', { is: true, then: false })).to.throw('Cannot combine match mode all with conditional rule');
            expect(() => Joi.alternatives().conditional('$a', { is: true, then: false }).match('all')).to.throw('Cannot combine match mode all with conditional rules');

            expect(() => Joi.alternatives().match('one').conditional('$a', { is: true, then: false })).to.throw('Cannot combine match mode one with conditional rule');
            expect(() => Joi.alternatives().conditional('$a', { is: true, then: false }).match('one')).to.throw('Cannot combine match mode one with conditional rules');

            expect(() => Joi.alternatives().match('any').conditional('$a', { is: true, then: false })).to.not.throw();
            expect(() => Joi.alternatives().conditional('$a', { is: true, then: false }).match('any')).to.not.throw();
        });
    });

    describe('tailor()', () => {

        it('customizes schema', () => {

            const alternatives = {
                v: (s) => s.min(10)
            };

            const before = Joi.object({
                x: Joi.alternatives([
                    Joi.number().alter(alternatives),
                    Joi.string().alter(alternatives)
                ])
            });

            const bd = before.describe();

            const first = before.tailor('v');

            const after = Joi.object({
                x: Joi.alternatives([
                    Joi.number().min(10).alter(alternatives),
                    Joi.string().min(10).alter(alternatives)
                ])
            });

            expect(first).to.equal(after);
            expect(first.describe()).to.equal(after.describe());
            expect(before.describe()).to.equal(bd);
        });

        it('customizes schema with outter rule', () => {

            const alt1 = {
                v: (s) => s.min(10)
            };

            const alt2 = {
                v: (s) => s.try(Joi.valid('x'))
            };

            const before = Joi.object({
                x: Joi.alternatives([
                    Joi.number().alter(alt1),
                    Joi.string().alter(alt1)
                ])
                    .alter(alt2)
            });

            const bd = before.describe();

            const first = before.tailor('v');

            const after = Joi.object({
                x: Joi.alternatives([
                    Joi.number().min(10).alter(alt1),
                    Joi.string().min(10).alter(alt1),
                    Joi.valid('x')
                ])
                    .alter(alt2)
            });

            expect(first).to.equal(after);
            expect(first.describe()).to.equal(after.describe());
            expect(before.describe()).to.equal(bd);
        });
    });

    describe('try()', () => {

        it('throws when missing alternatives', () => {

            expect(() => {

                Joi.alternatives().try();
            }).to.throw('Missing alternative schemas');
        });

        it('throws on unreachable condition', () => {

            expect(() => {

                Joi.object({

                    a: Joi.alternatives().conditional('b', { is: 6, then: 7, otherwise: 0 }).try(5),
                    b: Joi.any()
                });
            }).to.throw('Unreachable condition');
        });

        it('validates deep alternatives', () => {

            const schema = Joi.alternatives().try(
                Joi.boolean(),
                Joi.object({
                    p: Joi.alternatives().try(
                        Joi.boolean(),
                        Joi.string().valid('foo', 'bar')
                    )
                })
            );

            Helper.validate(schema, [
                [{ p: 1 }, false, null, {
                    message: '"value" does not match any of the allowed types',
                    details: [
                        {
                            message: '"value" does not match any of the allowed types',
                            path: [],
                            type: 'alternatives.match',
                            context: {
                                label: 'value',
                                message: '"value" must be a boolean. "p" does not match any of the allowed types',
                                value: { p: 1 },
                                details: [
                                    {
                                        message: '"value" must be a boolean',
                                        path: [],
                                        type: 'boolean.base',
                                        context: { label: 'value', value: { p: 1 } }
                                    },
                                    {
                                        message: '"p" does not match any of the allowed types',
                                        path: ['p'],
                                        type: 'alternatives.match',
                                        context: {
                                            key: 'p',
                                            label: 'p',
                                            message: '"p" must be a boolean. "p" must be one of [foo, bar]',
                                            value: 1,
                                            details: [
                                                {
                                                    message: '"p" must be a boolean',
                                                    path: ['p'],
                                                    type: 'boolean.base',
                                                    context: { label: 'p', key: 'p', value: 1 }
                                                },
                                                {
                                                    message: '"p" must be one of [foo, bar]',
                                                    path: ['p'],
                                                    type: 'any.only',
                                                    context: { value: 1, valids: ['foo', 'bar'], label: 'p', key: 'p' }
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }],
                [{ p: '...' }, false, null, {
                    message: '"value" does not match any of the allowed types',
                    details: [
                        {
                            message: '"value" does not match any of the allowed types',
                            path: [],
                            type: 'alternatives.match',
                            context: {
                                label: 'value',
                                message: '"value" must be a boolean. "p" does not match any of the allowed types',
                                value: { p: '...' },
                                details: [
                                    {
                                        message: '"value" must be a boolean',
                                        path: [],
                                        type: 'boolean.base',
                                        context: { label: 'value', value: { p: '...' } }
                                    },
                                    {
                                        message: '"p" does not match any of the allowed types',
                                        path: ['p'],
                                        type: 'alternatives.match',
                                        context: {
                                            key: 'p',
                                            label: 'p',
                                            message: '"p" must be a boolean. "p" must be one of [foo, bar]',
                                            value: '...',
                                            details: [
                                                {
                                                    message: '"p" must be a boolean',
                                                    path: ['p'],
                                                    type: 'boolean.base',
                                                    context: { label: 'p', key: 'p', value: '...' }
                                                },
                                                {
                                                    message: '"p" must be one of [foo, bar]',
                                                    path: ['p'],
                                                    type: 'any.only',
                                                    context: { value: '...', valids: ['foo', 'bar'], label: 'p', key: 'p' }
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }],
                [1, false, null, {
                    message: '"value" must be one of [boolean, object]',
                    details: [
                        {
                            message: '"value" must be one of [boolean, object]',
                            path: [],
                            type: 'alternatives.types',
                            context: { types: ['boolean', 'object'], label: 'value', value: 1 }
                        }
                    ]
                }]
            ]);
        });

        it('validates deep alternatives (with wrapArrays false)', () => {

            const schema = Joi.alternatives().try(
                Joi.boolean(),
                Joi.object({
                    p: Joi.alternatives().try(
                        Joi.boolean(),
                        Joi.string().valid('foo', 'bar')
                    )
                })
            ).prefs({ errors: { wrapArrays: false } });

            Helper.validate(schema, [
                [{ p: 1 }, false, null, {
                    message: '"value" does not match any of the allowed types',
                    details: [
                        {
                            message: '"value" does not match any of the allowed types',
                            path: [],
                            type: 'alternatives.match',
                            context: {
                                label: 'value',
                                message: '"value" must be a boolean. "p" does not match any of the allowed types',
                                value: { p: 1 },
                                details: [
                                    {
                                        message: '"value" must be a boolean',
                                        path: [],
                                        type: 'boolean.base',
                                        context: { label: 'value', value: { p: 1 } }
                                    },
                                    {
                                        message: '"p" does not match any of the allowed types',
                                        path: ['p'],
                                        type: 'alternatives.match',
                                        context: {
                                            key: 'p',
                                            label: 'p',
                                            message: '"p" must be a boolean. "p" must be one of foo, bar',
                                            value: 1,
                                            details: [
                                                {
                                                    message: '"p" must be a boolean',
                                                    path: ['p'],
                                                    type: 'boolean.base',
                                                    context: { label: 'p', key: 'p', value: 1 }
                                                },
                                                {
                                                    message: '"p" must be one of foo, bar',
                                                    path: ['p'],
                                                    type: 'any.only',
                                                    context: { value: 1, valids: ['foo', 'bar'], label: 'p', key: 'p' }
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }],
                [{ p: '...' }, false, null, {
                    message: '"value" does not match any of the allowed types',
                    details: [
                        {
                            message: '"value" does not match any of the allowed types',
                            path: [],
                            type: 'alternatives.match',
                            context: {
                                label: 'value',
                                message: '"value" must be a boolean. "p" does not match any of the allowed types',
                                value: { p: '...' },
                                details: [
                                    {
                                        message: '"value" must be a boolean',
                                        path: [],
                                        type: 'boolean.base',
                                        context: { label: 'value', value: { p: '...' } }
                                    },
                                    {
                                        message: '"p" does not match any of the allowed types',
                                        path: ['p'],
                                        type: 'alternatives.match',
                                        context: {
                                            key: 'p',
                                            label: 'p',
                                            message: '"p" must be a boolean. "p" must be one of foo, bar',
                                            value: '...',
                                            details: [
                                                {
                                                    message: '"p" must be a boolean',
                                                    path: ['p'],
                                                    type: 'boolean.base',
                                                    context: { label: 'p', key: 'p', value: '...' }
                                                },
                                                {
                                                    message: '"p" must be one of foo, bar',
                                                    path: ['p'],
                                                    type: 'any.only',
                                                    context: { value: '...', valids: ['foo', 'bar'], label: 'p', key: 'p' }
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }],
                [1, false, null, {
                    message: '"value" must be one of boolean, object',
                    details: [
                        {
                            message: '"value" must be one of boolean, object',
                            path: [],
                            type: 'alternatives.types',
                            context: { types: ['boolean', 'object'], label: 'value', value: 1 }
                        }
                    ]
                }]
            ]);
        });

        it('validates deep alternatives (with custom error)', () => {

            const schema = Joi.alternatives().try(Joi.boolean(), Joi.object({
                p: Joi.number()
            })).error(new Error('oops'));

            expect(schema.validate({ p: 'a' }).error).to.be.an.error('oops');
        });
    });

    describe('when()', () => {

        it('combines when() with tries', () => {

            const schema = Joi.object({
                a: Joi.boolean(),
                b: Joi.alternatives([
                    Joi.string(),
                    Joi.number()
                ])
                    .when('a', { is: true, then: Joi.required() })
            });

            expect(schema.validate({ a: true }).error).to.be.an.error('"b" is required');
            expect(schema.validate({ a: true, b: true }).error).to.be.an.error('"b" must be one of [string, number]');
            expect(schema.validate({ a: false }).error).to.not.exist();
        });
    });
});
