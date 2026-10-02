const path = require('path');

module.exports = {
  entry: {
    background: './src/background.js',
    options: './src/options/options.js',
    popup: './src/popup/popup.js',
    summary: './src/summary/summary.js',
  },
  output: {
    filename: '[name]-bundle.js',
    path: path.resolve(__dirname),
  },
  mode: 'development',
  devtool: 'inline-source-map',
};
