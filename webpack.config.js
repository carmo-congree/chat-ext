const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production', // Add this line to fix the warning
  entry: {
    popup: './src/popup.js',
    content: './src/content.js',
    background: './src/background.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader'
        ]
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]'
        }
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/popup.html',
      filename: 'popup.html',
      chunks: ['popup']
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.css'
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/assets', to: 'assets' }
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.css']
  },
  optimization: {
    runtimeChunk: false,
    splitChunks: false
  },
  performance: {
    hints: false
  },
  cache: false
};
