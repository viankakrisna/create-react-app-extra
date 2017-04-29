# Create React App Extra 

[![Greenkeeper badge](https://badges.greenkeeper.io/viankakrisna/create-react-app-extra.svg)](https://greenkeeper.io/)

This is a fork of `create-react-app` with a collection of features that is currently not enabled in it.

Notably:
- SASS/SCSS
- LESS
- Stylus
- CSS Modules
- Decorators
- Babel Preset Stage 0
- `npm run watch` -> Watching mode that is writing to the disk on development
- Webpack DLL Plugin

These features are currently disabled because it's not aligned with the vision of create-react-app maintainers / unstable. This repo is just here to be a testbed for me to play. Anybody that is using it should be noted that this is unofficial and support would be minimal.

To install it, run 

`npm install -g create-react-app-extra`

or 

`yarn global add create-react-app-extra`

and use 

`create-react-app-extra yourappname`

to bootstrap an app.
