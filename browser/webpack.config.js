'use strict';

const Path = require('path');
const Webpack = require('webpack');

module.exports = {
    entry: '../lib/index.js',
    output: {
        filename: './joi-browser.min.js',
        library: 'joi',
        libraryTarget: 'umd'
    },
    plugins: [
        new Webpack.DefinePlugin({
            Buffer: false
        })
    ],
    module: {
        rules: [
            {
                use: 'null-loader',
                include: [
                    Path.join(__dirname, '../lib/types/binary.js')
                ]
            },
            {
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        'presets': [
                            [
                                '@babel/preset-env',
                                {
                                    'targets': '> 1%, not IE 11, not dead'
                                }
                            ]
                        ]
                    }
                }
            }
        ]
    }
};
